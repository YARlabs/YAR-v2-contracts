// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC721Metadata } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import { YarLib } from "../../YarLib.sol";
import { YarRequest } from "../../YarRequest.sol";
import { YarResponse } from "../../YarResponse.sol";

import { ERC1967ProxyInitializable } from "../../utils/ERC1967ProxyInitializable.sol";
import { ERC1967Utils } from "../../utils/ERC1967Utils.sol";
import { BridgedEIP721 } from "./BridgedEIP721.sol";

contract YarBridge721 is IERC721Receiver {
    address public owner;
    uint256 public chainId;

    address public yarRequest;
    address public yarResponse;

    address public bridgedTokenImplementation;

    mapping(address bridgedToken => bool exists) public isBridgedToken;

    struct PeerInfo {
        address peerAddress;
        string nativeSymbol;
    }
    mapping(uint256 => PeerInfo) public peers;

    function setPeer(uint256 newChainId, address newPeer, string calldata newPeerNativeSymbol) external {
        require(msg.sender == owner, "only owner!");
        peers[newChainId] = PeerInfo(newPeer, newPeerNativeSymbol);
    }

    function getPeer(uint256 _chainId) public view returns (PeerInfo memory) {
        PeerInfo memory peer = peers[_chainId];

        if (peer.peerAddress == address(0)) {
            return PeerInfo(address(this), "");
        } else {
            return peer;
        }
    }

    constructor(
        address intialYarRequest,
        address intialYarResponse
    ) {
        yarRequest = intialYarRequest;
        yarResponse = intialYarResponse;
        bridgedTokenImplementation = address(new BridgedEIP721());
        chainId = block.chainid;
        owner = msg.sender;
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
        uint256 targetChainId,
        address recipient
    ) external returns (YarLib.YarTX memory) {
        string memory tokenName;
        string memory tokenSymbol;
        string memory tokenUri;

        IERC721Metadata _token = IERC721Metadata(token);

        try _token.name() returns (string memory _tokenName) {
            tokenName = _tokenName;
        } catch {
            tokenName = "";
        }

        try _token.symbol() returns (string memory _tokenSymbol) {
            tokenSymbol = _tokenSymbol;
        } catch {
            tokenSymbol = "";
        }

        try _token.tokenURI(tokenId) returns (string memory _tokenUri) {
            tokenUri = _tokenUri;
        } catch {
            tokenUri = "";
        }

        bool _isBridgedToken = isBridgedToken[token];
        uint256 originalChainId = _isBridgedToken ? BridgedEIP721(token).originalChainId() : chainId;
        address originalToken = _isBridgedToken ? BridgedEIP721(token).originalToken() : token;

        _token.safeTransferFrom(msg.sender, address(this), tokenId);

        bytes memory targetTx = abi.encodeWithSelector(
            YarBridge721.transferFrom.selector,
            originalChainId,
            originalToken,
            tokenId,
            tokenName,
            tokenSymbol,
            tokenUri,
            recipient
        );

        YarLib.YarTX memory yarTx = YarLib.YarTX(
            chainId,
            address(this),
            msg.sender,
            targetChainId,
            getPeer(targetChainId).peerAddress,
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
        string calldata tokenName,
        string calldata tokenSymbol,
        string calldata tokenUri,
        address recipient
    ) external {
        require(msg.sender == yarResponse, "Only YarResponse!");

        YarLib.YarTX memory trustedYarTx = YarResponse(yarResponse).trustedYarTx();
        require(getPeer(trustedYarTx.initialChainId).peerAddress == trustedYarTx.sender, "not peer!");

        if (originalChainId == chainId) {
            IERC721Metadata(originalToken).safeTransferFrom(address(this), recipient, tokenId);
        } else {
            address bridgedToken = getBridgedTokenAddress(originalChainId, originalToken);
            if (isBridgedToken[bridgedToken] == false) {
                _deployBridgedToken(originalChainId, originalToken, tokenName, tokenSymbol);
            }

            BridgedEIP721(bridgedToken).mint(recipient, tokenId, tokenUri);
        }
    }

    function _deployBridgedToken(
        uint256 originalChainId,
        address originalToken,
        string calldata name,
        string calldata symbol
    ) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(originalChainId, originalToken));
        ERC1967ProxyInitializable bridgedToken = new ERC1967ProxyInitializable{ salt: salt }();
        bridgedToken.init(
            bridgedTokenImplementation,
            abi.encodeWithSelector(
                BridgedEIP721.initialize.selector,
                originalChainId,
                originalToken,
                getPeer(originalChainId).nativeSymbol,
                name,
                symbol
            )
        );

        address bridgedTokenAddress = address(bridgedToken);
        isBridgedToken[bridgedTokenAddress] = true;
        return bridgedTokenAddress;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}