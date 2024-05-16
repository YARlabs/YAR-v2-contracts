// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract BridgeEIP721 is Initializable, ERC721Upgradeable, OwnableUpgradeable {
    uint256 public originalChainId;
    bytes public originalToken;
    string public originalTokenName;
    string public originalTokenSymbol;

    mapping(uint256 => string) uris;

    function initialize(
        uint256 _originalChainId,
        bytes memory _originalToken,
        string memory _originalTokenName,
        string memory _originalTokenSymbol
    ) external initializer {
        ERC721Upgradeable.__ERC721_init(
            string(abi.encodePacked("y", _originalTokenName)),
            string(abi.encodePacked("y", _originalTokenSymbol))
        );
        OwnableUpgradeable.__Ownable_init(msg.sender);
        originalTokenName = _originalTokenName;
        originalTokenSymbol = _originalTokenSymbol;
        originalChainId = _originalChainId;
        originalToken = _originalToken;
    }

    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        return uris[_tokenId];
    }

    function getOriginalTokenInfo() external view returns (uint256, bytes memory, string memory, string memory) {
        return (originalChainId, originalToken, originalTokenName, originalTokenSymbol);
    }

    function mint(address _recipient, uint256 _tokenId, string calldata _uri) external onlyOwner {
        uris[_tokenId] = _uri;
        _safeMint(_recipient, _tokenId);
    }

    function burn( uint256 _tokenId) external onlyOwner {
        _burn(_tokenId);
    }

    function permissionedTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external onlyOwner {
        _safeTransfer(_from, _to, _tokenId);
    }
}