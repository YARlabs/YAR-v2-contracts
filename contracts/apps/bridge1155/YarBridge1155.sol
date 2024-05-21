// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC1155MetadataURI } from "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import { YarLib } from "../../YarLib.sol";
import { YarRequest } from "../../YarRequest.sol";
import { YarResponse } from "../../YarResponse.sol";
import { ERC1967ProxyInitializable } from "../../utils/ERC1967ProxyInitializable.sol";
import { ERC1967Utils } from "../../utils/ERC1967Utils.sol";
import { BridgedEIP1155 } from "./BridgedEIP1155.sol";

contract YarBridge1155 is IERC1155Receiver {
    address public owner;
    uint256 public chainId;

    address public yarRequest;
    address public yarResponse;

    address public bridgedTokenImplementation;

    mapping(address bridgedToken => bool exists) public isBridgedToken;

    mapping(uint256 chainId => address peer) public peers;

    constructor(address intialYarRequest, address intialYarResponse) {
        yarRequest = intialYarRequest;
        yarResponse = intialYarResponse;
        bridgedTokenImplementation = address(new BridgedEIP1155());
        chainId = block.chainid;
        owner = msg.sender;
    }

    function setPeer(uint256 newChainId, address newPeer) external {
        require(msg.sender == owner, "only owner!");
        peers[newChainId] = newPeer;
    }

    function getPeer(uint256 _chainId) public view returns (address) {
        address peer = peers[_chainId];
        return peer == address(0) ? address(this) : peer;
    }

    function getBridgedTokenAddress(
        uint256 originalChainId,
        address originalToken
    ) public view returns (address) {
        return ERC1967Utils.getAddress(keccak256(abi.encodePacked(originalChainId, originalToken)));
    }

    function transferTo(
        address token,
        uint256 tokenId,
        uint256 amount,
        uint256 targetChainId,
        address recipient
    ) external returns (YarLib.YarTX memory) {
        require(amount > 0, "BridgeERC1155: _amounts contains zero value!");

        bool _isBridgedToken = isBridgedToken[token];
        uint256 originalChainId = _isBridgedToken
            ? BridgedEIP1155(token).originalChainId()
            : chainId;
        address originalToken = _isBridgedToken
            ? BridgedEIP1155(token).originalToken()
            : token;
        string memory tokenUri;

        IERC1155MetadataURI _token = IERC1155MetadataURI(token);

        try _token.uri(tokenId) returns (string memory _tokenUri) {
            tokenUri = _tokenUri;
        } catch {
            tokenUri = "";
        }

        _token.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        bytes memory targetTx = abi.encodeWithSelector(
            YarBridge1155.transferFrom.selector,
            originalChainId,
            originalToken,
            tokenId,
            amount,
            tokenUri,
            recipient
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

        return YarRequest(yarRequest).send(yarTx);
    }

    function transferToBatch(
        address token,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        uint256 targetChainId,
        address recipient
    ) external returns (YarLib.YarTX memory) {
        require(tokenIds.length > 0 && tokenIds.length == amounts.length, "length!");

        for (uint256 i; i < tokenIds.length; i++) {
            require(amounts[i] > 0, "BridgeERC1155: amounts contains zero value!");
        }

        bool _isBridgedToken = isBridgedToken[token];
        uint256 originalChainId = _isBridgedToken
            ? BridgedEIP1155(token).originalChainId()
            : chainId;
        address originalToken = _isBridgedToken
            ? BridgedEIP1155(token).originalToken()
            : token;
        string[] memory tokenUris = new string[](tokenIds.length);

        IERC1155MetadataURI _token = IERC1155MetadataURI(token);

        for (uint256 i; i < tokenIds.length; i++) {
            try _token.uri(tokenIds[i]) returns (string memory _tokenUri) {
                tokenUris[i] = _tokenUri;
            } catch {
                tokenUris[i] = "";
            }
        }

        _token.safeBatchTransferFrom(msg.sender, address(this), tokenIds, amounts, "");

        bytes memory targetTx = abi.encodeWithSelector(
            YarBridge1155.transferFromBatch.selector,
            originalChainId,
            originalToken,
            tokenIds,
            amounts,
            tokenUris,
            recipient
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

        return YarRequest(yarRequest).send(yarTx);
    }

    function transferFrom(
        uint256 originalChainId,
        address originalToken,
        uint256 tokenId,
        uint256 amount,
        string calldata uri,
        address recipient
    ) external {
        require(msg.sender == yarResponse, "Only YarResponse!");

        YarLib.YarTX memory trustedYarTx = YarResponse(yarResponse).trustedYarTx();
        require(getPeer(trustedYarTx.initialChainId) == trustedYarTx.sender, "not peer!");

        if (originalChainId == chainId) {
            IERC1155MetadataURI(originalToken).safeTransferFrom(
                address(this),
                recipient,
                tokenId,
                amount,
                ""
            );
        } else {
            address bridgedToken = getBridgedTokenAddress(originalChainId, originalToken);
            if (isBridgedToken[bridgedToken] == false) {
                _deployBridgedToken(originalChainId, originalToken);
            }

            BridgedEIP1155(bridgedToken).mint(recipient, tokenId, amount, uri);
        }
    }

    function transferFromBatch(
        uint256 originalChainId,
        address originalToken,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        string[] calldata uris,
        address recipient
    ) external {
        require(msg.sender == yarResponse, "Only YarResponse!");

        YarLib.YarTX memory trustedYarTx = YarResponse(yarResponse).trustedYarTx();
        require(getPeer(trustedYarTx.initialChainId) == trustedYarTx.sender, "not peer!");

        if (originalChainId == chainId) {
            IERC1155MetadataURI(originalToken).safeBatchTransferFrom(
                address(this),
                recipient,
                tokenIds,
                amounts,
                ""
            );
        } else {
            address bridgedToken = getBridgedTokenAddress(originalChainId, originalToken);
            if (isBridgedToken[bridgedToken] == false) {
                _deployBridgedToken(originalChainId, originalToken);
            }

            BridgedEIP1155(bridgedToken).mintBatch(recipient, tokenIds, amounts, uris);
        }
    }

    function _deployBridgedToken(
        uint256 originalChainId,
        address originalToken
    ) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(originalChainId, originalToken));
        ERC1967ProxyInitializable bridgedToken = new ERC1967ProxyInitializable{ salt: salt }();
        bridgedToken.init(
            bridgedTokenImplementation,
            abi.encodeWithSelector(
                BridgedEIP1155.initialize.selector,
                originalChainId,
                originalToken
            )
        );

        address bridgedTokenAddress = address(bridgedToken);
        isBridgedToken[bridgedTokenAddress] = true;
        return bridgedTokenAddress;
    }

    function supportsInterface(bytes4 interfaceID) external pure override returns (bool) {
        return
            interfaceID == type(ERC1155).interfaceId ||
            interfaceID == type(IERC1155MetadataURI).interfaceId;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
