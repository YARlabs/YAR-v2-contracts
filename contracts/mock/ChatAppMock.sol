// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { YarConnector } from "../YarConnector.sol";

contract ChatAppMock {
    struct Message {
        address from;
        address to;
        bytes secretMessage;
        bytes fromSignature;
    }

    mapping(address => Message[]) public messages;

    address public yarConnector;

    constructor(address intialYarConnector) {
        yarConnector = intialYarConnector;
    }

    function messagesLength(address account) external view returns (uint256) {
        return messages[account].length;
    }

    function sendMessage(
        Message calldata message,
        YarConnector.CrossCallData calldata crossCallData
    ) external payable {
        bytes memory targetTx = abi.encodeWithSelector(
            ChatAppMock.receiveMessage.selector,
            message
        );
        require(keccak256(crossCallData.data) == keccak256(targetTx), "targetTx!");

        YarConnector(yarConnector).crossCallFrom{ value: msg.value }(crossCallData);
    }

    function sendMessagePermit(
        Message calldata message,
        YarConnector.CrossCallData calldata crossCallData,
        uint256 permitSignatureExpired,
        bytes calldata permitSignature
    ) external payable {
        bytes memory targetTx = abi.encodeWithSelector(
            ChatAppMock.receiveMessage.selector,
            message
        );
        require(keccak256(crossCallData.data) == keccak256(targetTx), "targetTx!");

        YarConnector(yarConnector).permit(
            crossCallData,
            permitSignatureExpired,
            permitSignature
        );

        YarConnector(yarConnector).crossCallFrom{ value: msg.value }(crossCallData);
    }

    function receiveMessage(Message calldata message) external {
        require(msg.sender == yarConnector, "only yarConnector!");
        messages[message.to].push(message);
    }
}
