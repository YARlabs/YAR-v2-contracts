// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { YarLib } from "./YarLib.sol";

contract YarHub {
    address public relayer;

    enum TxStatus {
        NotExists,
        WaitForPay,
        InProgress,
        Completed,
        Rejected
    }

    struct WrappedYarTX {
        YarLib.YarTX yarTx;
        TxStatus status;
        uint256 lockedFees;
        uint256 usedFees;
        bytes32 initialTxHash;
        bytes32 targetTxHash;
    }

    mapping(bytes32 yarTxHash => WrappedYarTX hubTx) public wrappedYarTXs;

    event CreateTransaction(YarLib.YarTX yarTx);

    event ExecuteTransaction(YarLib.YarTX yarTx);

    event CommitTransaction(
        YarLib.YarTX yarTx,
        TxStatus status,
        uint256 usedFees,
        uint256 feesToReturn
    );

    event Deposit(address account, uint256 amount);

    constructor(address initialRelayer) {
        relayer = initialRelayer;
    }

    mapping(address account => uint256 feeTokenAmount) public deposits;

    function deposit(address account, uint256 feeTokenAmount) external {
        require(msg.sender == relayer, "only relayer!");
        deposits[account] += feeTokenAmount;
        emit Deposit(account, feeTokenAmount);
    }

    function createTransaction(YarLib.YarTX calldata yarTX, bytes32 initialTxHash) external {
        require(msg.sender == relayer, "only relayer!");
        bytes32 yarTxHash = keccak256(abi.encode(yarTX));
        wrappedYarTXs[yarTxHash] = WrappedYarTX(
            yarTX,
            TxStatus.WaitForPay,
            0,
            0,
            initialTxHash,
            bytes32(0)
        );
        emit CreateTransaction(yarTX);
    }

    function executeTransaction(YarLib.YarTX calldata yarTX, uint256 feeTokensToLock) external {
        require(msg.sender == relayer, "only relayer!");
        bytes32 yarTxHash = keccak256(abi.encode(yarTX));
        require(wrappedYarTXs[yarTxHash].status == TxStatus.WaitForPay, "only WaitForPay!");
        require(deposits[yarTX.sender] >= feeTokensToLock, "feeTokensToLock!");
        wrappedYarTXs[yarTxHash].lockedFees = feeTokensToLock;
        wrappedYarTXs[yarTxHash].status = TxStatus.InProgress;

        emit ExecuteTransaction(yarTX);
    }

    function completeTransaction(
        YarLib.YarTX calldata yarTX,
        bytes32 targetTxHash,
        uint256 usedFees
    ) external {
        _commitTransaction(yarTX, targetTxHash, TxStatus.Completed, usedFees);
    }

    function rejectTransaction(
        YarLib.YarTX calldata yarTX,
        bytes32 targetTxHash,
        uint256 usedFees
    ) external {
        _commitTransaction(yarTX, targetTxHash, TxStatus.Rejected, usedFees);
    }

    function _commitTransaction(
        YarLib.YarTX calldata yarTX,
        bytes32 targetTxHash,
        TxStatus status,
        uint256 usedFees
    ) internal {
        require(msg.sender == relayer, "only relayer!");
        bytes32 yarTxHash = keccak256(abi.encode(yarTX));
        require(
            wrappedYarTXs[yarTxHash].status == TxStatus.InProgress,
            "only on progress can updated!"
        );

        wrappedYarTXs[yarTxHash].status = status;
        wrappedYarTXs[yarTxHash].usedFees = usedFees;
        wrappedYarTXs[yarTxHash].targetTxHash = targetTxHash;

        uint256 lockedFees = wrappedYarTXs[yarTxHash].lockedFees;
        uint256 feesToReturn = lockedFees > usedFees ? lockedFees - usedFees : 0;
        deposits[yarTX.sender] += feesToReturn;

        emit CommitTransaction(yarTX, status, usedFees, feesToReturn);
    }
}
