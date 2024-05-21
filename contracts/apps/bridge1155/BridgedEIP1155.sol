// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { ERC1155Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract BridgedEIP1155 is Initializable, ERC1155Upgradeable, OwnableUpgradeable {
    uint256 public originalChainId;
    address public originalToken;

    mapping(uint256 => string) uris;

    function initialize(
        uint256 _originalChainId,
        address _originalToken
    ) external initializer {
        ERC1155Upgradeable.__ERC1155_init("");
        OwnableUpgradeable.__Ownable_init(msg.sender);
        originalChainId = _originalChainId;
        originalToken = _originalToken;
    }

    function uri(uint256 _tokenId) public view override returns (string memory) {
        return uris[_tokenId];
    }

    function uriBatch(uint256[] memory _tokenIds) public view returns (string[] memory) {
        uint256 l = _tokenIds.length;
        string[] memory _uris = new string[](l);

        for (uint256 i; i < l; i++) {
            _uris[i] = uris[_tokenIds[i]];
        }

        return _uris;
    }

    function getOriginalTokenInfo() external view returns (uint256, address) {
        return (originalChainId, originalToken);
    }

    function mint(
        address _recipient,
        uint256 _tokenId,
        uint256 _amount,
        string calldata _uri
    ) external onlyOwner {
        uris[_tokenId] = _uri;
        _mint(_recipient, _tokenId, _amount, "");
    }

    function mintBatch(
        address _recipient,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts,
        string[] memory _uris
    ) external onlyOwner {
        require(_tokenIds.length == _amounts.length && _tokenIds.length == _uris.length, "length!");
        uint256 l = _tokenIds.length;

        for (uint256 i; i < l; i++) {
            uris[_tokenIds[i]] = _uris[i];
        }

        _mintBatch(_recipient, _tokenIds, _amounts, "");
    }

    function burn(address _account, uint256 _tokenId, uint256 _amount) external onlyOwner {
        _burn(_account, _tokenId, _amount);
    }

    function burnBatch(
        address _account,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts
    ) external onlyOwner {
        _burnBatch(_account, _tokenIds, _amounts);
    }
}
