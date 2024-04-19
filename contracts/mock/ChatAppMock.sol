// // SPDX-License-Identifier: UNLICENSED
// pragma solidity 0.8.20;

// import { YarRequest } from "../YarRequest.sol";
// import { YarResponse } from "../YarResponse.sol";
// import { YarLib } from "../YarLib.sol";

// contract ChatAppMock {
//     struct Message {
//         address from;
//         address to;
//         bytes secretMessage;
//         bytes fromSignature;
//     }

//     mapping(address => Message[]) public messages;

//     address public yarRequest;
//     address public yarResponse;

//     constructor(address intialYarRequest, address intialYarResponse) {
//         yarRequest = intialYarRequest;
//         yarResponse = intialYarResponse;
//     }

//     function messagesLength(address account) external view returns (uint256) {
//         return messages[account].length;
//     }

//     function sendMessage(Message calldata message, YarLib.YarTX calldata yarTX) public payable {
//         require(msg.sender == yarTX.sender || msg.sender == yarRequest, "yarTX.sender!");
//         bytes memory targetTx = abi.encodeWithSelector(
//             ChatAppMock.receiveMessage.selector,
//             message
//         );
//         require(keccak256(yarTX.data) == keccak256(targetTx), "targetTx!");

//         YarRequest(yarRequest).sendFrom{ value: msg.value }(yarTX);
//     }

//     function sendMessagePermit(
//         Message calldata message,
//         YarLib.YarTX calldata yarTX,
//         uint256 permitSignatureExpired,
//         bytes calldata permitSignature
//     ) external payable {
//         YarRequest(yarRequest).permit(yarTX, permitSignatureExpired, permitSignature);
//         sendMessage(message, yarTX);
//     }

//     function receiveMessage(Message calldata message) external {
//         require(msg.sender == yarResponse, "only yarResponse!");
//         messages[message.to].push(message);
//     }
// }
