// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { YarLib } from "./YarLib.sol";

contract YarResponse {

    address public relayer;

    YarLib.YarTX public trustedCrossCallData;

    constructor(address intialRelayer) {
        relayer = intialRelayer;
    }

    function onCrossCall(YarLib.YarTX calldata data) external payable {
        require(msg.sender == relayer, "only relayer!");
        require(data.value == msg.value, "msg.value!");

        trustedCrossCallData = data;

        (bool success, bytes memory result) = data.target.call{ value: data.value }(data.data);
        if (success == false) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }

        delete trustedCrossCallData;
    }
}
