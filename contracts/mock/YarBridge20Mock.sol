// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { YarRequest } from "../YarRequest.sol";
import { YarResponse } from "../YarResponse.sol";
import { YarLib } from "../YarLib.sol";
import { YarBridge20 } from "../apps/bridge20/YarBridge20.sol";

contract YarBridge20Mock is YarBridge20 {
    constructor(
        address intialYarRequest,
        address intialYarResponse
    ) YarBridge20("Ethereum", "ETH", 18, intialYarRequest, intialYarResponse) {
        chainId = 111;
    }
}
