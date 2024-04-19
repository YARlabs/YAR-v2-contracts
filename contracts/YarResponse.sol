// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { YarLib } from "./YarLib.sol";

contract YarResponse {
    address public relayer;

    YarLib.YarTX internal _trustedYarTx;

    function trustedYarTx() external view returns (YarLib.YarTX memory) {
        return _trustedYarTx;
    }

    constructor(address intialRelayer) {
        relayer = intialRelayer;
    }

    function deliver(YarLib.YarTX calldata yarTx) external payable {
        require(msg.sender == relayer, "only relayer!");
        require(yarTx.value == msg.value, "msg.value!");

        _trustedYarTx = yarTx;

        (bool success, bytes memory result) = yarTx.target.call{ value: yarTx.value }(yarTx.data);
        if (success == false) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }

        delete _trustedYarTx;
    }
}
