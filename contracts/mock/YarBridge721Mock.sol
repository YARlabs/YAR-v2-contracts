// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { YarRequest } from "../YarRequest.sol";
import { YarResponse } from "../YarResponse.sol";
import { YarLib } from "../YarLib.sol";
import { YarBridge721 } from "../apps/bridge721/YarBridge721.sol";

contract YarBridge721Mock is YarBridge721 {
    constructor(
        address intialYarRequest,
        address intialYarResponse
    ) YarBridge721(intialYarRequest, intialYarResponse) {
        chainId = 111;
    }
}
