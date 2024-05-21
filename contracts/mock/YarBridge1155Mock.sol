// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { YarRequest } from "../YarRequest.sol";
import { YarResponse } from "../YarResponse.sol";
import { YarLib } from "../YarLib.sol";
import { YarBridge1155 } from "../apps/bridge1155/YarBridge1155.sol";

contract YarBridge1155Mock is YarBridge1155 {
    constructor(
        address intialYarRequest,
        address intialYarResponse
    ) YarBridge1155(intialYarRequest, intialYarResponse) {
        chainId = 111;
    }
}
