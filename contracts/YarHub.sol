// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { YarLib } from "./YarLib.sol";
import { YarResponse } from "./YarResponse.sol";

contract YarHub {
    address public relayer;

    uint256 public feesRatio;

    uint256 public totalLockedFees;
    uint256 public feesBalance;
    uint256 public earnedFees;

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
    
    mapping(address account => uint256 feeTokenAmount) public deposits;
    
    mapping(address account => mapping(uint256 chainId => mapping(address spender => uint256 amount)))
        public allowance;

    event CreateTransaction(YarLib.YarTX yarTx, bytes32 yarTxHash);

    event ExecuteTransaction(YarLib.YarTX yarTx, bytes32 yarTxHash);

    event CommitTransaction(
        YarLib.YarTX yarTx,
        bytes32 yarTxHash,
        TxStatus status,
        uint256 usedFees,
        uint256 feesToReturn
    );

    event Deposit(address account, uint256 amount);

    event Approve(address account, uint256 intiailChainId, address spender, uint256 amount);

    event EarnedFees(uint256 amount);

    constructor(address initialRelayer, uint256 initialFeesRatio) {
        relayer = initialRelayer;
        require(initialFeesRatio <= 10000, "initialFeesRatio > 100%");
        feesRatio = initialFeesRatio;
    }

    receive() external payable {}

    function setFeesRatio(uint256 newFeesRation) external {
        require(msg.sender == relayer, "only relayer!");
        require(newFeesRation <= 10000, "newFeesRation > 100%");
        feesRatio = newFeesRation;
    }

    function withdrawFees(uint256 amount) external {
        require(msg.sender == relayer, "only relayer!");
        require(amount <= feesBalance, "feesBalance!");
        feesBalance -= amount;
        (bool success, bytes memory result) = msg.sender.call{ value: amount }("");
        if (success == false) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function getYarTxHash(YarLib.YarTX calldata yarTX) public pure returns (bytes32) {
        return keccak256(abi.encode(yarTX));
    }

    function deposit(address account, uint256 feeTokenAmount) public {
        require(msg.sender == relayer, "only relayer!");
        deposits[account] += feeTokenAmount;
        emit Deposit(account, feeTokenAmount);
    }

    function withdraw(uint256 amount) external {
        require(deposits[msg.sender] >= amount, "amount!");
        deposits[msg.sender] -= amount;
        (bool success, bytes memory result) = msg.sender.call{ value: amount }("");
        if (success == false) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function approve(
        address account,
        uint256 intiailChainId,
        address spender,
        uint256 amount
    ) external {
        require(msg.sender == relayer, "only relayer!");
        allowance[account][intiailChainId][spender] = amount;
        emit Approve(account, intiailChainId, spender, amount);
    }

    function createTransaction(YarLib.YarTX calldata yarTX, bytes32 initialTxHash) external {
        require(msg.sender == relayer, "only relayer!");
        bytes32 yarTxHash = getYarTxHash(yarTX);
        wrappedYarTXs[yarTxHash] = WrappedYarTX(
            yarTX,
            TxStatus.WaitForPay,
            0,
            0,
            initialTxHash,
            bytes32(0)
        );
        emit CreateTransaction(yarTX, getYarTxHash(yarTX));
    }

    function executeTransaction(YarLib.YarTX calldata yarTX, uint256 feeTokensToLock) external {
        require(msg.sender == relayer, "only relayer!");
        bytes32 yarTxHash = keccak256(abi.encode(yarTX));
        require(wrappedYarTXs[yarTxHash].status == TxStatus.WaitForPay, "only WaitForPay!");

        require(deposits[yarTX.payer] >= feeTokensToLock, "feeTokensToLock!");
        if (yarTX.payer != yarTX.sender) {
            require(
                allowance[yarTX.payer][yarTX.initialChainId][yarTX.sender] >= feeTokensToLock,
                "deposit allowance!"
            );
            allowance[yarTX.payer][yarTX.initialChainId][yarTX.sender] -= feeTokensToLock;
        }
        deposits[yarTX.payer] -= feeTokensToLock;
        wrappedYarTXs[yarTxHash].lockedFees = feeTokensToLock;
        wrappedYarTXs[yarTxHash].status = TxStatus.InProgress;

        totalLockedFees += feeTokensToLock;

        emit ExecuteTransaction(yarTX, getYarTxHash(yarTX));
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

        feesBalance += usedFees;

        uint256 txEarnedFees = (((1e18 * usedFees) / (10000 + feesRatio)) * feesRatio) / 1e18;
        earnedFees += txEarnedFees;

        uint256 lockedFees = wrappedYarTXs[yarTxHash].lockedFees;
        uint256 feesToReturn = lockedFees > usedFees ? lockedFees - usedFees : 0;
        deposits[yarTX.payer] += feesToReturn;

        totalLockedFees -= lockedFees;

        emit EarnedFees(txEarnedFees);
        emit CommitTransaction(yarTX, getYarTxHash(yarTX), status, usedFees, feesToReturn);
    }
}
