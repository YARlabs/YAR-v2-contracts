// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
// import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
// import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
// import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";
import { YarLib } from "./YarLib.sol";
// import "hardhat/console.sol";
contract YarRequest 
// is EIP712, Nonces, ERC2771Context, ReentrancyGuard 
{
    using SafeERC20 for IERC20;

    address public relayer;
    address public feeToken;

    // string private constant PERMIT_TYPE =
    //     "Permit(uint256 nonce,uint256 signatureExpired,YarTX yarTX)";
    // string private constant CROSS_CALL_DATA_TYPE =
    //     "YarTX(uint256 initialChainId,address sender,address app,uint256 targetChainId,address target,uint256 value,bytes data,uint256 depositToYarAmount)";

    // bytes32 private constant PERMIT_TYPEHASH =
    //     keccak256(abi.encodePacked(PERMIT_TYPE, CROSS_CALL_DATA_TYPE));

    // bytes32 private constant CROSS_CALL_DATA_TYPEHASH =
    //     keccak256(abi.encodePacked(CROSS_CALL_DATA_TYPE));

    mapping(address sender => mapping(address app => mapping(bytes32 yarTxHash => bool approved)))
        public approvals;

    event Send(YarLib.YarTX yarTx);

    event Deposit(address depositor, address feesToken, uint256 amount);

    constructor(
        // address intialYarForwarder,
        address intialRelayer,
        address initailFeeToken
    ) 
    // EIP712("YarRequest", "1") ERC2771Context(intialYarForwarder) 
    {
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

    // function approveAndCallApp(
    //     bytes calldata appData,
    //     YarLib.YarTX calldata yarTX
    // ) external payable {
    //     require(yarTX.app != address(this), "self call disabled!");
    //     approve(yarTX);
    //     (bool success, bytes memory result) = yarTX.app.call{ value: msg.value }(
    //         appData
    //     );
    //     if (success == false) {
    //         assembly {
    //             revert(add(result, 32), mload(result))
    //         }
    //     }
    // }

    // function approveDeposit(address ) public {
    //     require(yarTX.sender == msg.sender, "only sender!");
    //     _approve(yarTX);
    // }

    // function approve(YarLib.YarTX calldata yarTX) public {
    //     require(yarTX.sender == msg.sender, "only sender!");
    //     _approve(yarTX);
    // }

    // function _approve(YarLib.YarTX calldata yarTX) internal {
    //     approvals[yarTX.sender][yarTX.app][keccak256(abi.encode(yarTX))] = true;
    // }

    // function sendFrom(YarLib.YarTX calldata yarTX) external payable {
    //     address sender = yarTX.sender;
    //     address app = yarTX.app;

    //     require(app == msg.sender, "app != msg.sender");

    //     bytes32 yarTxHash = keccak256(abi.encode(yarTX));
    //     require(approvals[sender][app][yarTxHash], "not approved!");
    //     delete approvals[sender][app][yarTxHash];

    //     _send(yarTX);
    // }

    // function permit(
    //     YarLib.YarTX calldata yarTX,
    //     uint256 signatureExpired,
    //     bytes calldata signature
    // ) external {
    //     require(block.timestamp < signatureExpired, "signatureExpired!");

    //     bytes32 structHash = keccak256(
    //         abi.encode(
    //             PERMIT_TYPEHASH,
    //             _useNonce(yarTX.sender),
    //             signatureExpired,
    //             keccak256(
    //                 abi.encode(
    //                     CROSS_CALL_DATA_TYPEHASH,
    //                     yarTX.initialChainId,
    //                     yarTX.sender,
    //                     yarTX.app,
    //                     yarTX.targetChainId,
    //                     yarTX.target,
    //                     yarTX.value,
    //                     keccak256(yarTX.data),
    //                     yarTX.depositToYarAmount
    //                 )
    //             )
    //         )
    //     );
    //     require(
    //         SignatureChecker.isValidSignatureNow(
    //             yarTX.sender,
    //             _hashTypedDataV4(structHash),
    //             signature
    //         ),
    //         "signature!"
    //     );
    //     _approve(yarTX);
    // }

    // function send(YarLib.YarTX calldata yarTX) external payable {
    //     address sender = msg.sender;

    //     require(yarTX.sender == sender, "sender!");
    //     require(yarTX.app == sender, "app != sender");

    //     _send(yarTX);
    // }

    // function _send(YarLib.YarTX memory yarTX) internal {
    //     require(yarTX.initialChainId == block.chainid, "initialChainId!");
    //     require(yarTX.targetChainId != block.chainid, "targetChainId!");

    //     if (yarTX.depositToYarAmount > 0) {
    //         deposit(yarTX.sender, yarTX.depositToYarAmount);
    //     }
    //     emit Send(yarTX);
    // }

    function send(YarLib.YarTX memory yarTX) external payable {
        require(yarTX.sender == msg.sender, "sender!");
        require(yarTX.initialChainId == block.chainid, "initialChainId!");
        require(yarTX.targetChainId != block.chainid, "targetChainId!");

        // if (yarTX.depositToYarAmount > 0) {
        //     deposit(yarTX.sender, yarTX.depositToYarAmount);
        // }
        emit Send(yarTX);
    }
}
