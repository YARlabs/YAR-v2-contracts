pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";


contract MockERC1155 is ERC1155 {
    constructor() ERC1155("") {}

    mapping(uint256 => string) uris;

    function uri(uint256 _tokenId) public view override returns (string memory) {
        return uris[_tokenId];
    }

    function uriBatch(uint256[] memory _tokenIds) public view returns (string[] memory) {
        uint256 l = _tokenIds.length;
        string[] memory _uris = new string[](l);
        for(uint256 i; i < l; i++) {
            _uris[i] = uris[_tokenIds[i]];
        }
        return _uris;
    }

    function mint(address account, uint256 id, uint256 amount, string calldata _uri) external {
        uris[id] = _uri;
        _mint(account, id, amount, "");
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, string[] memory _uris) external {
        require(ids.length == _uris.length, "IssuedERC1155: _tokenIds and _uris length mismatch");

        uint256 l = ids.length;
        for(uint256 i; i < l; i++) {
            uris[ids[i]] = _uris[i];
        }

        _mintBatch(to, ids, amounts, "");
    }
}