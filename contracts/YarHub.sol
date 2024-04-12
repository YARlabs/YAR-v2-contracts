// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract YarHub {
    address public relayer;
    enum TransactionStatus {
        // WaitFees,
        Pending,
        Completed,
        Rejected
    }

    struct Transaction {
        address peer;
        uint256 initialChainId;
        uint256 targetChainId;
        address target;
        bytes data;
        TransactionStatus status;
    }

    event AddPendingTransaction(
        uint256 transactionIndex,
        address peer,
        uint256 initialChainId,
        uint256 targetChainId,
        address target,
        bytes data
    );

    event UpdateTransactionStatus(uint256 transactionIndex, TransactionStatus status);
    // event DepositFees(address depositor, uint256 amount);

    Transaction[] public transactions;

    mapping(address account => uint256 amount) public feeBalance;

    constructor(address initialRelayer) {
        relayer = initialRelayer;
    }

    // function depositFees(address depositor, uint256 amount) external {
    //     require(msg.sender == relayer, "only realayer!");
    //     feeBalance[depositor] += amount;
    //     emit DepositFees(depositor, amount);
    // }

    function addTransaction(
        address peer,
        uint256 initialChainId,
        uint256 targetChainId,
        address target,
        bytes calldata data
    ) external {
        require(msg.sender == relayer, "only realayer!");
        uint256 transactionIndex = transactions.length;
        transactions.push(
            Transaction(
                peer,
                initialChainId,
                targetChainId,
                target,
                data,
                TransactionStatus.Pending
            )
        );
        emit AddPendingTransaction(
            transactionIndex,
            peer,
            initialChainId,
            targetChainId,
            target,
            data
        );
    }

    function setTransactionStatus(uint256 transactionIndex, TransactionStatus status) external {
        require(msg.sender == relayer, "only realayer!");
        transactions[transactionIndex].status = status;
        emit UpdateTransactionStatus(transactionIndex, status);
    }
}
