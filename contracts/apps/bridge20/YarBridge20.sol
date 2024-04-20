// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { YarLib } from "../../YarLib.sol";
import { YarRequest } from "../../YarRequest.sol";
import { YarResponse } from "../../YarResponse.sol";
import { ERC1967ProxyInitializable } from "./ERC1967ProxyInitializable.sol";
import { IssuedEIP20 } from "./IssuedEIP20.sol";
import "hardhat/console.sol";
contract YarBridge20 {
    using SafeERC20 for IERC20Metadata;

    address public owner;

    address public yarRequest;
    address public yarResponse;

    address public issuedTokenImplementation;

    mapping(address issuedToken => bool exists) public isIssuedToken;

    uint256 public chainId;

    mapping(uint256 chainId => address peer) public peers;

    string public nativeName;
    string public nativeSymbol;
    uint8 public nativeDecimals;

    function setPeer(uint256 newChainId, address newPeer) external {
        require(msg.sender == owner, "only owner!");
        peers[newChainId] = newPeer;
    }

    function getPeer(uint256 _chainId) public view returns(address) {
        address peer = peers[_chainId];
        return peer == address(0) ? address(this) : peer;
    }

    constructor(
        string memory initialNativeName,
        string memory initialNativeSymbol,
        uint8 initialNativeDecimals,
        address intialYarRequest,
        address intialYarResponse
    ) {
        nativeName = initialNativeName;
        nativeSymbol = initialNativeSymbol;
        nativeDecimals = initialNativeDecimals;
        yarRequest = intialYarRequest;
        yarResponse = intialYarResponse;
        issuedTokenImplementation = address(new IssuedEIP20());
        chainId = block.chainid;
        owner = tx.origin;
    }

    function deployFrom(
        uint256 originalChainId,
        address originalToken,
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) external {
        require(msg.sender == yarResponse, "only yarRequest!");

        address issuedToken = getIssuedTokenAddress(originalChainId, originalToken);
        require(isIssuedToken[issuedToken] == false, "already exists!");

        _deployIssuedToken(originalChainId, originalToken, name, symbol, decimals);
    }

    function deployTo(address token, uint256 targetChainId) external payable {
        string memory name;
        string memory symbol;
        uint8 decimals;
        if (token == address(0)) {
            name = nativeName;
            symbol = nativeSymbol;
            decimals = nativeDecimals;
        } else {
            name = IERC20Metadata(token).name();
            symbol = IERC20Metadata(token).symbol();
            decimals = IERC20Metadata(token).decimals();
        }

        uint256 originalChain;
        address originalToken;
        if (isIssuedToken[token]) {
            originalChain = IssuedEIP20(token).originalChain();
            originalToken = IssuedEIP20(token).originalToken();
        } else {
            originalChain = chainId;
            originalToken = token;
        }

        YarRequest(yarRequest).send(
            YarLib.YarTX(
                chainId,
                address(this),
                msg.sender,
                targetChainId,
                getPeer(targetChainId),
                0,
                abi.encodeWithSelector(
                    YarBridge20.deployFrom.selector,
                    originalChain,
                    originalToken,
                    name,
                    symbol,
                    decimals
                )
            )
        );
    }

    function transferFrom(
        uint256 originalChainId,
        address originalToken,
        uint256 amount,
        address recipient
    ) external {
        require(msg.sender == yarResponse, "only yarResponse!");
        YarLib.YarTX memory trustedYarTx = YarResponse(yarResponse).trustedYarTx();
        require(getPeer(trustedYarTx.initialChainId) == trustedYarTx.sender, "not peer!");
        if (originalChainId == chainId) {
            if (originalToken == address(0)) {
                (bool success, bytes memory result) = recipient.call{ value: amount }("");
                if (success == false) {
                    assembly {
                        revert(add(result, 32), mload(result))
                    }
                }
            } else {
                IERC20Metadata(originalToken).safeTransfer(recipient, amount);
            }
        } else {
            address issuedToken = getIssuedTokenAddress(originalChainId, originalToken);
            require(isIssuedToken[issuedToken], "before deploy issued token!");
            IssuedEIP20(issuedToken).mint(recipient, amount);
        }
    }

    function reverseRejectedTransfer() external {}

    function transferTo(
        address token,
        uint256 amount,
        uint256 targetChainId,
        address recipient
    ) external payable {
        uint256 transferAmount = amount;
        address feeToken = YarRequest(yarRequest).feeToken();

        if (token == address(0)) {
            require(msg.value == transferAmount, "transferAmount!");
        } else {
            IERC20Metadata(token).safeTransferFrom(msg.sender, address(this), transferAmount);
        }

        bool _isIssuedToken = isIssuedToken[token];

        uint256 originalChainId = _isIssuedToken ? IssuedEIP20(token).originalChain() : chainId;
        address originalToken = _isIssuedToken ? IssuedEIP20(token).originalToken() : token;

        bytes memory targetTx = abi.encodeWithSelector(
            YarBridge20.transferFrom.selector,
            originalChainId,
            originalToken,
            amount,
            recipient
        );

        YarLib.YarTX memory yarTX = YarLib.YarTX(
            chainId,
            address(this),
            msg.sender,
            targetChainId,
            getPeer(targetChainId),
            0,
            targetTx
        );

        YarRequest(yarRequest).send(yarTX);
    }

    function getIssuedTokenAddress(
        uint256 originalChainId,
        address originalToken
    ) public view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(originalChainId, originalToken));
        return
            address(
                uint160(
                    uint(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                salt,
                                keccak256(
                                    abi.encodePacked(type(ERC1967ProxyInitializable).creationCode)
                                )
                            )
                        )
                    )
                )
            );
    }

    function _deployIssuedToken(
        uint256 originalChainId,
        address originalToken,
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(originalChainId, originalToken));
        ERC1967ProxyInitializable issuedToken = new ERC1967ProxyInitializable{ salt: salt }();
        issuedToken.init(
            issuedTokenImplementation,
            abi.encodeWithSelector(
                IssuedEIP20.initialize.selector,
                originalChainId,
                originalToken,
                name,
                symbol,
                decimals
            )
        );

        address issuedTokenAddress = address(issuedToken);
        isIssuedToken[issuedTokenAddress] = true;
        return issuedTokenAddress;
    }
}
