// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PredictionMarket
/// @notice Minimal YES/NO prediction market using Arc Network's native USDC as the betting token.
///         Users send native USDC directly with each bet — no ERC-20 approval required.
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
        address allowedAddress; // only relevant when isPrivate = true
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

    // ─────────────────────────────────────────────────────────────────────────
    // Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Create a new prediction market.
    /// @param question     The prediction question displayed to users.
    /// @param endTime      Unix timestamp after which betting is closed.
    /// @param isPrivate    Whether participation is restricted to one address.
    /// @param allowedAddress  Address allowed to bet (ignored when isPrivate = false).
    function createMarket(string calldata question, uint256 endTime, bool isPrivate, address allowedAddress)
        external
        returns (uint256 marketId)
    {
        require(bytes(question).length > 0, "PredictionMarket: empty question");
        require(endTime > block.timestamp, "PredictionMarket: end time in the past");

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
            allowedAddress: allowedAddress
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
    /// @param outcome   true = YES won, false = NO won.
    function resolveMarket(uint256 marketId, bool outcome) external {
        require(marketId < marketCount, "PredictionMarket: market does not exist");

        Market storage market = markets[marketId];

        require(msg.sender == market.creator, "PredictionMarket: only creator can resolve");
        require(!market.resolved, "PredictionMarket: market already resolved");
        require(block.timestamp >= market.endTime, "PredictionMarket: market has not ended yet");

        market.resolved = true;
        market.outcome = outcome;

        emit MarketResolved(marketId, outcome);
    }

    /// @notice Claim proportional winnings from a resolved market.
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

        uint256 winningPool = market.outcome ? market.totalYesPool : market.totalNoPool;
        uint256 totalPool = market.totalYesPool + market.totalNoPool;

        // Proportional payout: (user bet / winning pool) * total pool
        uint256 payout = (userBet.amount * totalPool) / winningPool;

        (bool success,) = payable(msg.sender).call{value: payout}("");
        require(success, "PredictionMarket: transfer failed");

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns all data for a market in a single call.
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
            address allowedAddress
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
            m.allowedAddress
        );
    }

    /// @notice Returns the bet a user has placed on a market.
    function getUserBet(uint256 marketId, address user) external view returns (uint256 amount, bool isYes) {
        Bet storage b = bets[marketId][user];
        return (b.amount, b.isYes);
    }
}
