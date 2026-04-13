// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PredictionMarket
/// @notice YES/NO prediction market with optional fixed-odds support.
///         Uses Arc Network's native USDC as the betting token.
///
///         Two modes:
///           Pool-based  (oddsYes == 0): proportional payout from losing pool (legacy).
///           Fixed-odds  (oddsYes  > 0): fixed multiplier payout backed by operator house pool.
contract PredictionMarket {
    // ─────────────────────────────────────────────────────────────────────────
    // Data Structures
    // ─────────────────────────────────────────────────────────────────────────

    struct Market {
        string question;
        address creator;
        uint256 endTime;
        bool resolved;
        bool outcome; // true = YES won, false = NO won
        uint256 totalYesPool;
        uint256 totalNoPool;
        bool isPrivate;
        address allowedAddress;
        // Fixed-odds fields — all zero for legacy pool-based markets
        string yesLabel; // e.g. "Spain wins the World Cup"
        string noLabel; // e.g. "Spain doesn't win the World Cup"
        uint256 oddsYes; // payout multiplier × 100  (e.g. 592 = 5.92×)
        uint256 oddsNo; // payout multiplier × 100  (e.g. 113 = 1.13×)
        uint256 housePool; // initial USDC seeded by creator/operator
    }

    struct Bet {
        uint256 amount;
        bool isYes;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public marketCount;

    /// @dev marketId → Market
    mapping(uint256 => Market) public markets;

    /// @dev marketId → user → Bet
    mapping(uint256 => mapping(address => Bet)) public bets;

    /// @dev marketId → user → claimed
    mapping(uint256 => mapping(address => bool)) public claimed;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        uint256 endTime,
        bool isPrivate,
        address allowedAddress
    );

    event BetPlaced(uint256 indexed marketId, address indexed bettor, uint256 amount, bool isYes);

    event MarketResolved(uint256 indexed marketId, bool outcome);

    event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);

    event HousePoolWithdrawn(uint256 indexed marketId, address indexed creator, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Create a new prediction market.
    /// @param question        The prediction question displayed to users.
    /// @param endTime         Unix timestamp after which betting is closed.
    /// @param isPrivate       Whether participation is restricted to one address.
    /// @param allowedAddress  Address allowed to bet (ignored when isPrivate = false).
    /// @param yesLabel        Human-readable YES outcome (empty = pool-based market).
    /// @param noLabel         Human-readable NO outcome.
    /// @param oddsYes         YES payout multiplier × 100. 0 = pool-based mode.
    /// @param oddsNo          NO payout multiplier × 100. 0 = pool-based mode.
    /// @dev For fixed-odds markets msg.value becomes the house pool backing payouts.
    function createMarket(
        string calldata question,
        uint256 endTime,
        bool isPrivate,
        address allowedAddress,
        string calldata yesLabel,
        string calldata noLabel,
        uint256 oddsYes,
        uint256 oddsNo
    ) external payable returns (uint256 marketId) {
        require(bytes(question).length > 0, "PredictionMarket: empty question");
        require(endTime > block.timestamp, "PredictionMarket: end time in the past");

        bool isFixedOdds = oddsYes > 0 || oddsNo > 0;
        if (isFixedOdds) {
            require(oddsYes > 100, "PredictionMarket: oddsYes must be > 100");
            require(oddsNo > 100, "PredictionMarket: oddsNo must be > 100");
            require(msg.value > 0, "PredictionMarket: fixed-odds market requires house pool");
        }

        marketId = marketCount++;

        markets[marketId] = Market({
            question: question,
            creator: msg.sender,
            endTime: endTime,
            resolved: false,
            outcome: false,
            totalYesPool: 0,
            totalNoPool: 0,
            isPrivate: isPrivate,
            allowedAddress: allowedAddress,
            yesLabel: yesLabel,
            noLabel: noLabel,
            oddsYes: oddsYes,
            oddsNo: oddsNo,
            housePool: msg.value
        });

        emit MarketCreated(marketId, msg.sender, question, endTime, isPrivate, allowedAddress);
    }

    /// @notice Place a bet on a market using native USDC sent with the transaction.
    /// @param marketId  The ID of the market to bet on.
    /// @param isYes     true = bet YES, false = bet NO.
    function placeBet(uint256 marketId, bool isYes) external payable {
        require(marketId < marketCount, "PredictionMarket: market does not exist");
        require(msg.value > 0, "PredictionMarket: bet amount must be > 0");

        Market storage market = markets[marketId];

        require(block.timestamp < market.endTime, "PredictionMarket: betting period has ended");
        require(!market.resolved, "PredictionMarket: market already resolved");

        if (market.isPrivate) {
            require(msg.sender == market.allowedAddress, "PredictionMarket: not allowed in private market");
        }

        Bet storage userBet = bets[marketId][msg.sender];
        require(userBet.amount == 0, "PredictionMarket: already placed a bet");

        // Fixed-odds: verify contract can cover the worst-case payout before accepting.
        if (market.oddsYes > 0) {
            uint256 newYesPool = market.totalYesPool + (isYes ? msg.value : 0);
            uint256 newNoPool = market.totalNoPool + (isYes ? 0 : msg.value);
            uint256 maxYesPayout = (newYesPool * market.oddsYes) / 100;
            uint256 maxNoPayout = (newNoPool * market.oddsNo) / 100;
            uint256 maxPayout = maxYesPayout > maxNoPayout ? maxYesPayout : maxNoPayout;
            // Available = house pool + all bets (this bet included)
            uint256 available = market.housePool + newYesPool + newNoPool;
            require(maxPayout <= available, "PredictionMarket: insufficient liquidity");
        }

        userBet.amount = msg.value;
        userBet.isYes = isYes;

        if (isYes) {
            market.totalYesPool += msg.value;
        } else {
            market.totalNoPool += msg.value;
        }

        emit BetPlaced(marketId, msg.sender, msg.value, isYes);
    }

    /// @notice Resolve a market. Only callable by the market creator after endTime.
    /// @param marketId  The ID of the market to resolve.
    /// @param _outcome  true = YES won, false = NO won.
    function resolveMarket(uint256 marketId, bool _outcome) external {
        require(marketId < marketCount, "PredictionMarket: market does not exist");

        Market storage market = markets[marketId];

        require(msg.sender == market.creator, "PredictionMarket: only creator can resolve");
        require(!market.resolved, "PredictionMarket: market already resolved");
        require(block.timestamp >= market.endTime, "PredictionMarket: market has not ended yet");

        market.resolved = true;
        market.outcome = _outcome;

        emit MarketResolved(marketId, _outcome);
    }

    /// @notice Claim winnings from a resolved market.
    ///         Fixed-odds: payout = betAmount × odds / 100.
    ///         Pool-based: payout = (betAmount / winningPool) × totalPool.
    /// @param marketId  The ID of the resolved market.
    function claimWinnings(uint256 marketId) external {
        require(marketId < marketCount, "PredictionMarket: market does not exist");

        Market storage market = markets[marketId];

        require(market.resolved, "PredictionMarket: market not resolved yet");
        require(!claimed[marketId][msg.sender], "PredictionMarket: already claimed");

        Bet storage userBet = bets[marketId][msg.sender];

        require(userBet.amount > 0, "PredictionMarket: no bet found");
        require(userBet.isYes == market.outcome, "PredictionMarket: you did not win");

        claimed[marketId][msg.sender] = true;

        uint256 payout;
        if (market.oddsYes > 0) {
            // Fixed-odds payout
            uint256 odds = market.outcome ? market.oddsYes : market.oddsNo;
            payout = (userBet.amount * odds) / 100;
        } else {
            // Pool-based proportional payout
            uint256 winningPool = market.outcome ? market.totalYesPool : market.totalNoPool;
            uint256 totalPool = market.totalYesPool + market.totalNoPool;
            payout = (userBet.amount * totalPool) / winningPool;
        }

        (bool success,) = payable(msg.sender).call{value: payout}("");
        require(success, "PredictionMarket: transfer failed");

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    /// @notice Creator reclaims the remaining house pool after market resolution.
    ///         For fixed-odds markets: call this after all winners have claimed to
    ///         avoid draining funds needed for outstanding payouts.
    /// @param marketId  The ID of the resolved market.
    function withdrawHousePool(uint256 marketId) external {
        require(marketId < marketCount, "PredictionMarket: market does not exist");

        Market storage market = markets[marketId];

        require(market.resolved, "PredictionMarket: market not resolved yet");
        require(msg.sender == market.creator, "PredictionMarket: only creator can withdraw");
        require(market.oddsYes > 0, "PredictionMarket: pool-based markets have no house pool");
        require(market.housePool > 0, "PredictionMarket: nothing to withdraw");

        uint256 amount = market.housePool;
        market.housePool = 0;

        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "PredictionMarket: transfer failed");

        emit HousePoolWithdrawn(marketId, msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns all fields for a market in a single call.
    function getMarket(uint256 marketId)
        external
        view
        returns (
            string memory question,
            address creator,
            uint256 endTime,
            bool resolved,
            bool outcome,
            uint256 totalYesPool,
            uint256 totalNoPool,
            bool isPrivate,
            address allowedAddress,
            string memory yesLabel,
            string memory noLabel,
            uint256 oddsYes,
            uint256 oddsNo,
            uint256 housePool
        )
    {
        require(marketId < marketCount, "PredictionMarket: market does not exist");
        Market storage m = markets[marketId];
        return (
            m.question,
            m.creator,
            m.endTime,
            m.resolved,
            m.outcome,
            m.totalYesPool,
            m.totalNoPool,
            m.isPrivate,
            m.allowedAddress,
            m.yesLabel,
            m.noLabel,
            m.oddsYes,
            m.oddsNo,
            m.housePool
        );
    }

    /// @notice Returns the bet a user has placed on a market.
    function getUserBet(uint256 marketId, address user) external view returns (uint256 amount, bool isYes) {
        Bet storage b = bets[marketId][user];
        return (b.amount, b.isYes);
    }
}
