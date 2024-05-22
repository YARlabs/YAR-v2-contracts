// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { YarLib } from "../../YarLib.sol";
import { YarRequest } from "../../YarRequest.sol";
import { YarResponse } from "../../YarResponse.sol";

contract YarBridgeMessage {
    address public owner;
    uint256 public chainId;

    address public yarRequest;
    address public yarResponse;

    mapping(uint256 chainId => address peer) public peers;

    function setPeer(uint256 newChainId, address newPeer) external {
        require(msg.sender == owner, "only owner!");
        peers[newChainId] = newPeer;
    }

    function getPeer(uint256 _chainId) public view returns (address) {
        address peer = peers[_chainId];
        return peer == address(0) ? address(this) : peer;
    }

    constructor(
        address intialYarRequest,
        address intialYarResponse
    ) {
        yarRequest = intialYarRequest;
        yarResponse = intialYarResponse;
        chainId = block.chainid;
        owner = msg.sender;
    }

    function sendTo(
        uint256 targetChainId,
        string memory message
    ) external returns (YarLib.YarTX memory) {
        bytes memory targetTx = abi.encodeWithSelector(
            YarBridgeMessage.sendFrom.selector,
            msg.sender,
            message
        );

        YarLib.YarTX memory yarTx = YarLib.YarTX(
            chainId,
            address(this),
            msg.sender,
            targetChainId,
            getPeer(targetChainId),
            0,
            targetTx,
            0
        );

        YarRequest(yarRequest).send(yarTx);

        return yarTx;
    }

    struct Message {
        address sender;
        string message;
        uint256 timestamp;
    }

    Message[] public messages;
    uint256 public messageCount;

    function getMessages(uint offset, uint limit) public view returns (Message[] memory) {
        require(offset < messageCount, "Offset out of range");

        uint end = offset + limit;
        if (end > messageCount) {
            end = messageCount;
        }

        uint resultSize = end - offset;
        Message[] memory result = new Message[](resultSize);

        uint index = 0;
        for (uint i = messageCount - offset; i > messageCount - end; i--) {
            result[index] = messages[i - 1];
            index++;
        }

        return result;
    }

    function sendFrom(
        address sender,
        string calldata message
    ) external {
        require(msg.sender == yarResponse, "Only YarResponse!");

        YarLib.YarTX memory trustedYarTx = YarResponse(yarResponse).trustedYarTx();
        require(getPeer(trustedYarTx.initialChainId) == trustedYarTx.sender, "not peer!");

        messages.push(Message(
            sender,
            message,
            block.timestamp
        ));
        messageCount++;
    }
}