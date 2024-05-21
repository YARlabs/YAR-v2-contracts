// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC1155MetadataURI } from "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import { YarLib } from "../../YarLib.sol";
import { YarRequest } from "../../YarRequest.sol";
import { YarResponse } from "../../YarResponse.sol";

import { ERC1967ProxyInitializable } from "./ERC1967ProxyInitializable.sol";
import { BridgeEIP1155 } from "./BridgeEIP1155.sol";


contract YarBridge1155 is IERC1155Receiver {
    address public owner;
    uint256 public chainId;

    address public yarRequest;
    address public yarResponse;

    address public bridgedTokenImplementation;

    mapping(address bridgedToken => bool exists) public isBridgedToken;

    mapping(address => bool) public issuedTokens;

    function isIssuedTokenPublished(address _issuedToken) public view returns (bool) {
        return issuedTokens[_issuedToken];
    }

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
        bridgedTokenImplementation = address(new BridgeEIP1155());
        chainId = block.chainid;
        owner = msg.sender;
    }

    function getTokenAddress(
        uint256 originalChainId,
        address token1155
    ) public view returns (address) {
        bytes memory originalToken = abi.encode(token1155);
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
                                keccak256(abi.encodePacked(type(ERC1967ProxyInitializable).creationCode))
                            )
                        )
                    )
                )
            );
    }

    function transferTo(
        address token1155,
        uint256 tokenId,
        uint256 amount,
        uint256 targetChainId,
        address recipient
    ) external returns (YarLib.YarTX memory) {
        require(amount > 0, "BridgeERC1155: _amounts contains zero value!");

        bool _isBridgedToken = isBridgedToken[token1155];
        uint256 originalChainId = _isBridgedToken ? BridgeEIP1155(token1155).originalChainId() : chainId;
        bytes memory originalToken = _isBridgedToken ? BridgeEIP1155(token1155).originalToken() : abi.encode(token1155);
        string memory tokenUri;

        IERC1155MetadataURI token = IERC1155MetadataURI(token1155);

        try token.uri(tokenId) returns (string memory _tokenUri) {
            tokenUri = _tokenUri;
        } catch {
            tokenUri = "";
        }

        token.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

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

        YarRequest(yarRequest).send(yarTx);

        return yarTx;
    }

    function transferToBatch(
        address token1155,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        uint256 targetChainId,
        address recipient
    ) external returns (YarLib.YarTX memory) {
        uint256 tokensLength = tokenIds.length;
        require(tokensLength > 0, "BridgeERC1155: tokenIds.length == 0");
        require(
            tokensLength == amounts.length,
            "BridgeERC1155: tokenIds.length != amounts.length"
        );
        for(uint256 i; i < tokensLength; i++) {
            require(amounts[i] > 0, "BridgeERC1155: amounts contains zero value!");
        }

        bool _isBridgedToken = isBridgedToken[token1155];
        uint256 originalChainId = _isBridgedToken ? BridgeEIP1155(token1155).originalChainId() : chainId;
        bytes memory originalToken = _isBridgedToken ? BridgeEIP1155(token1155).originalToken() : abi.encode(token1155);
        string[] memory tokenUris = new string[](tokensLength);

        IERC1155MetadataURI token = IERC1155MetadataURI(token1155);

        for (uint256 i; i < tokensLength; i++) {
            try token.uri(tokenIds[i]) returns (string memory _tokenUri) {
                tokenUris[i] = _tokenUri;
            } catch {
                tokenUris[i] = "";
            }
        }

        token.safeBatchTransferFrom(msg.sender, address(this), tokenIds, amounts, "");

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

        YarRequest(yarRequest).send(yarTx);

        return yarTx;
    }

    function transferFrom(
        uint256 originalChainId,
        bytes calldata originalToken,
        uint256 tokenId,
        uint256 amount,
        string calldata uri,
        address recipient
    ) external {
        require(msg.sender == yarResponse, "Only YarResponse!");

        YarLib.YarTX memory trustedYarTx = YarResponse(yarResponse).trustedYarTx();
        require(getPeer(trustedYarTx.initialChainId) == trustedYarTx.sender, "not peer!");

        if (originalChainId == chainId) {
            address originalTokenAddress = abi.decode(originalToken, (address));
            IERC1155MetadataURI token = IERC1155MetadataURI(originalTokenAddress);
            token.safeTransferFrom(address(this), recipient, tokenId, amount, "");
        } else {
            address issuedTokenAddress = getBridgedTokenAddress(originalChainId, originalToken);
            if (!isIssuedTokenPublished(issuedTokenAddress)) {
                publicNewToken(originalChainId, originalToken);
            }

            BridgeEIP1155(issuedTokenAddress).mint(recipient, tokenId, amount, uri);
        }
    }

    function transferFromBatch(
        uint256 originalChainId,
        bytes calldata originalToken,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        string[] calldata uris,
        address recipient
    ) external {
        require(msg.sender == yarResponse, "Only YarResponse!");

        YarLib.YarTX memory trustedYarTx = YarResponse(yarResponse).trustedYarTx();
        require(getPeer(trustedYarTx.initialChainId) == trustedYarTx.sender, "not peer!");

        if (originalChainId == chainId) {
            address originalTokenAddress = abi.decode(originalToken, (address));
            IERC1155MetadataURI token = IERC1155MetadataURI(originalTokenAddress);
            token.safeBatchTransferFrom(address(this), recipient, tokenIds, amounts, "");
        } else {
            address issuedTokenAddress = getBridgedTokenAddress(originalChainId, originalToken);
            if (!isIssuedTokenPublished(issuedTokenAddress)) {
                publicNewToken(originalChainId, originalToken);
            }

            BridgeEIP1155(issuedTokenAddress).mintBatch(recipient, tokenIds, amounts, uris);
        }
    }

    function publicNewToken(
        uint256 originalChainId,
        bytes calldata originalToken
    ) internal returns (address)  {
        bytes32 salt = keccak256(abi.encodePacked(originalChainId, originalToken));
        ERC1967ProxyInitializable bridgedToken = new ERC1967ProxyInitializable{ salt: salt }();
        bridgedToken.init(
            bridgedTokenImplementation,
            abi.encodeWithSelector(
                BridgeEIP1155.initialize.selector,
                originalChainId,
                originalToken
            )
        );

        address bridgedTokenAddress = address(bridgedToken);
        isBridgedToken[bridgedTokenAddress] = true;
        return bridgedTokenAddress;
    }

    function getBridgedTokenAddress(
        uint256 originalChainId,
        bytes calldata originalToken
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
                                keccak256(abi.encodePacked(type(ERC1967ProxyInitializable).creationCode))
                            )
                        )
                    )
                )
            );
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
