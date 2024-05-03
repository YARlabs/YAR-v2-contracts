// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { YarLib } from "./YarLib.sol";

contract YarRequest {
    using SafeERC20 for IERC20;

    address public relayer;
    address public feeToken;

    uint256 public nonce;

    mapping(address sender => mapping(address app => mapping(bytes32 yarTxHash => bool approved)))
        public approvals;

    event Send(YarLib.YarTX yarTx);

    event Deposit(address depositor, address feesToken, uint256 amount);

    event Approve(address account, uint256 initialChainId, address spender, uint256 amount);

    constructor(address intialRelayer, address initailFeeToken) {
        relayer = intialRelayer;
        feeToken = initailFeeToken;
    }

    function deposit(uint256 amount) public payable {
        if (feeToken == address(0)) {
            require(msg.value == amount, "amount!");
            (bool success, bytes memory result) = relayer.call{ value: amount }("");
            if (success == false) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
        } else {
            IERC20(feeToken).safeTransferFrom(msg.sender, relayer, amount);
        }
        emit Deposit(msg.sender, feeToken, amount);
    }

    function approve(address spender, uint256 amount) public {
        emit Approve(msg.sender, block.chainid, spender, amount);
    }

    function send(YarLib.YarTX memory yarTX) external returns (YarLib.YarTX memory) {
        require(yarTX.sender == msg.sender, "sender!");
        require(yarTX.initialChainId == block.chainid, "initialChainId!");
        require(yarTX.targetChainId != block.chainid, "targetChainId!");
        yarTX._nonce = nonce++;

        emit Send(yarTX);

        return yarTX;
    }
}
