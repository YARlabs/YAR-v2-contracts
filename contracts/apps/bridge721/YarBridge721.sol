// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC721Metadata } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import { YarLib } from "../../YarLib.sol";
import { YarRequest } from "../../YarRequest.sol";
import { YarResponse } from "../../YarResponse.sol";
import { ERC1967ProxyInitializable } from "./ERC1967ProxyInitializable.sol";
import { BridgeEIP721 } from "./BridgeEIP721.sol";



contract YarBridge721 is IERC721Receiver {
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
        bridgedTokenImplementation = address(new BridgeEIP721());
        chainId = block.chainid;
        owner = msg.sender;
    }

    function getTokenAddress(
        uint256 originalChainId,
        address token721
    ) public view returns (address) {
        bytes memory originalToken = abi.encode(token721);
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
        address token721,
        uint256 tokenId,
        uint256 targetChainId,
        address recipient
    ) external returns (YarLib.YarTX memory) {
        string memory tokenName;
        string memory tokenSymbol;
        string memory tokenUri;

        IERC721Metadata token = IERC721Metadata(token721);

        try token.name() returns (string memory _tokenName) {
            tokenName = _tokenName;
        } catch {
            tokenName = "";
        }

        try token.symbol() returns (string memory _tokenSymbol) {
            tokenSymbol = _tokenSymbol;
        } catch {
            tokenSymbol = "";
        }

        try token.tokenURI(tokenId) returns (string memory _tokenUri) {
            tokenUri = _tokenUri;
        } catch {
            tokenUri = "";
        }

        bool _isBridgedToken = isBridgedToken[token721];
        uint256 originalChainId = _isBridgedToken ? BridgeEIP721(token721).originalChainId() : chainId;
        bytes memory originalToken = _isBridgedToken ? BridgeEIP721(token721).originalToken() : abi.encode(token721);

        token.safeTransferFrom(msg.sender, address(this), tokenId);

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
        string memory tokenName,
        string memory tokenSymbol,
        string memory tokenUri,
        address recipient
    ) external {
        require(msg.sender == yarResponse, "Only YarResponse!");

        YarLib.YarTX memory trustedYarTx = YarResponse(yarResponse).trustedYarTx();
        require(getPeer(trustedYarTx.initialChainId) == trustedYarTx.sender, "not peer!");

        if (originalChainId == chainId) {
            address originalTokenAddress = abi.decode(originalToken, (address));
            IERC721Metadata token = IERC721Metadata(originalTokenAddress);
            token.safeTransferFrom(address(this), recipient, tokenId);
        } else {
            address issuedTokenAddress = getBridgedTokenAddress(originalChainId, originalToken);
            if (!isIssuedTokenPublished(issuedTokenAddress)) {
                publicNewToken(originalChainId, originalToken, tokenName, tokenSymbol);
            }

            BridgeEIP721(issuedTokenAddress).mint(recipient, tokenId, tokenUri);
        }
    }

    function publicNewToken(
        uint256 originalChainId,
        bytes calldata originalToken,
        string memory tokenName,
        string memory tokenSymbol
    ) internal returns (address)  {
        bytes32 salt = keccak256(abi.encodePacked(originalChainId, originalToken));
        ERC1967ProxyInitializable bridgedToken = new ERC1967ProxyInitializable{ salt: salt }();
        bridgedToken.init(
            bridgedTokenImplementation,
            abi.encodeWithSelector(
                BridgeEIP721.initialize.selector,
                originalChainId,
                originalToken,
                tokenName,
                tokenSymbol
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

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}