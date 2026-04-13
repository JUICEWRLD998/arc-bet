// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";

contract PredictionMarketTest is Test {
    PredictionMarket public market;

    address public creator = address(0x1);
    address public bettor1 = address(0x2);
    address public bettor2 = address(0x3);

    uint256 public endTime;

    function setUp() public {
        market = new PredictionMarket();
        endTime = block.timestamp + 1 days;

        // Fund test accounts with native USDC (native token on Arc, behaves like ETH in tests)
        vm.deal(creator, 100 ether);
        vm.deal(bettor1, 100 ether);
        vm.deal(bettor2, 100 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // createMarket
    // ─────────────────────────────────────────────────────────────────────────

    function test_CreateMarket() public {
        vm.prank(creator);
        uint256 id = market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        assertEq(id, 0);
        assertEq(market.marketCount(), 1);

        (
            string memory question,
            address mCreator,
            uint256 mEndTime,
            bool resolved,
            ,
            ,
            ,
            bool isPrivate,
        ) = market.getMarket(0);

        assertEq(question, "Will ETH hit $10k?");
        assertEq(mCreator, creator);
        assertEq(mEndTime, endTime);
        assertFalse(resolved);
        assertFalse(isPrivate);
    }

    function test_CreateMarket_RevertOnEmptyQuestion() public {
        vm.prank(creator);
        vm.expectRevert("PredictionMarket: empty question");
        market.createMarket("", endTime, false, address(0));
    }

    function test_CreateMarket_RevertOnPastEndTime() public {
        vm.prank(creator);
        vm.expectRevert("PredictionMarket: end time in the past");
        market.createMarket("Will ETH hit $10k?", block.timestamp - 1, false, address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // placeBet
    // ─────────────────────────────────────────────────────────────────────────

    function test_PlaceBet_Yes() public {
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        vm.prank(bettor1);
        market.placeBet{value: 10 ether}(0, true);

        (, , , , , uint256 totalYesPool, uint256 totalNoPool, , ) = market.getMarket(0);
        assertEq(totalYesPool, 10 ether);
        assertEq(totalNoPool, 0);

        (uint256 amount, bool isYes) = market.getUserBet(0, bettor1);
        assertEq(amount, 10 ether);
        assertTrue(isYes);
    }

    function test_PlaceBet_No() public {
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        vm.prank(bettor2);
        market.placeBet{value: 5 ether}(0, false);

        (, , , , , uint256 totalYesPool, uint256 totalNoPool, , ) = market.getMarket(0);
        assertEq(totalYesPool, 0);
        assertEq(totalNoPool, 5 ether);
    }

    function test_PlaceBet_RevertAfterEndTime() public {
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        vm.warp(endTime + 1);

        vm.prank(bettor1);
        vm.expectRevert("PredictionMarket: betting period has ended");
        market.placeBet{value: 10 ether}(0, true);
    }

    function test_PlaceBet_RevertDoubleBet() public {
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        vm.startPrank(bettor1);
        market.placeBet{value: 10 ether}(0, true);
        vm.expectRevert("PredictionMarket: already placed a bet");
        market.placeBet{value: 5 ether}(0, false);
        vm.stopPrank();
    }

    function test_PlaceBet_PrivateMarket_Success() public {
        vm.prank(creator);
        market.createMarket("Private Q", endTime, true, bettor1);

        vm.prank(bettor1);
        market.placeBet{value: 10 ether}(0, true);

        (uint256 amount,) = market.getUserBet(0, bettor1);
        assertEq(amount, 10 ether);
    }

    function test_PlaceBet_PrivateMarket_RevertUnauthorized() public {
        vm.prank(creator);
        market.createMarket("Private Q", endTime, true, bettor1);

        vm.prank(bettor2);
        vm.expectRevert("PredictionMarket: not allowed in private market");
        market.placeBet{value: 10 ether}(0, true);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // resolveMarket
    // ─────────────────────────────────────────────────────────────────────────

    function test_ResolveMarket() public {
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        vm.warp(endTime + 1);

        vm.prank(creator);
        market.resolveMarket(0, true);

        (, , , bool resolved, bool outcome, , , , ) = market.getMarket(0);
        assertTrue(resolved);
        assertTrue(outcome);
    }

    function test_ResolveMarket_RevertBeforeEndTime() public {
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        vm.prank(creator);
        vm.expectRevert("PredictionMarket: market has not ended yet");
        market.resolveMarket(0, true);
    }

    function test_ResolveMarket_RevertNonCreator() public {
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        vm.warp(endTime + 1);

        vm.prank(bettor1);
        vm.expectRevert("PredictionMarket: only creator can resolve");
        market.resolveMarket(0, true);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // claimWinnings — full happy path
    // ─────────────────────────────────────────────────────────────────────────

    function test_ClaimWinnings_HappyPath() public {
        // Create market
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        // bettor1 bets YES: 10 ETH
        vm.prank(bettor1);
        market.placeBet{value: 10 ether}(0, true);

        // bettor2 bets NO: 5 ETH
        vm.prank(bettor2);
        market.placeBet{value: 5 ether}(0, false);

        // Resolve: YES wins
        vm.warp(endTime + 1);
        vm.prank(creator);
        market.resolveMarket(0, true);

        // bettor1 claims — should receive full pool (10 + 5 = 15 ETH) since only YES winner
        uint256 balanceBefore = bettor1.balance;
        vm.prank(bettor1);
        market.claimWinnings(0);
        uint256 balanceAfter = bettor1.balance;

        assertEq(balanceAfter - balanceBefore, 15 ether);
    }

    function test_ClaimWinnings_RevertDoubleClam() public {
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        vm.prank(bettor1);
        market.placeBet{value: 10 ether}(0, true);

        vm.warp(endTime + 1);
        vm.prank(creator);
        market.resolveMarket(0, true);

        vm.startPrank(bettor1);
        market.claimWinnings(0);
        vm.expectRevert("PredictionMarket: already claimed");
        market.claimWinnings(0);
        vm.stopPrank();
    }

    function test_ClaimWinnings_RevertLoser() public {
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        vm.prank(bettor1);
        market.placeBet{value: 10 ether}(0, true);

        vm.prank(bettor2);
        market.placeBet{value: 5 ether}(0, false);

        vm.warp(endTime + 1);
        vm.prank(creator);
        market.resolveMarket(0, true); // YES wins

        vm.prank(bettor2); // bettor2 bet NO
        vm.expectRevert("PredictionMarket: you did not win");
        market.claimWinnings(0);
    }

    function test_ClaimWinnings_ProportionalPayout() public {
        vm.prank(creator);
        market.createMarket("Will ETH hit $10k?", endTime, false, address(0));

        // Two YES bettors: 10 and 10. One NO bettor: 20. YES wins.
        address bettor3 = address(0x4);
        vm.deal(bettor3, 100 ether);

        vm.prank(bettor1);
        market.placeBet{value: 10 ether}(0, true);

        vm.prank(bettor3);
        market.placeBet{value: 10 ether}(0, true);

        vm.prank(bettor2);
        market.placeBet{value: 20 ether}(0, false);

        vm.warp(endTime + 1);
        vm.prank(creator);
        market.resolveMarket(0, true);

        // Each YES bettor contributed 50% of YES pool → gets 50% of total pool (40 ETH)
        uint256 b1Before = bettor1.balance;
        vm.prank(bettor1);
        market.claimWinnings(0);
        assertEq(bettor1.balance - b1Before, 20 ether);

        uint256 b3Before = bettor3.balance;
        vm.prank(bettor3);
        market.claimWinnings(0);
        assertEq(bettor3.balance - b3Before, 20 ether);
    }
}
