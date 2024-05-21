// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { YarRequest } from "../YarRequest.sol";
import { YarResponse } from "../YarResponse.sol";
import { YarLib } from "../YarLib.sol";
import { YarBridgeMessage } from "../apps/bridgeMessage/YarBridgeMessage.sol";

contract YarBridgeMessageMock is YarBridgeMessage {
    constructor(
        address intialYarRequest,
        address intialYarResponse
    ) YarBridgeMessage(intialYarRequest, intialYarResponse) {
        chainId = 111;
    }
}
