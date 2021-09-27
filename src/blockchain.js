/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
          try {
            block.previousBlockHash = self.chain.length ? self.chain[self.chain.length-1].hash : '';
            block.height = await self.getChainHeight() + 1;
            block.time = new Date().getTime().toString().slice(0,-3);
            block.hash = block.computeHash();
            self.chain.push(block);
            self.height = block.height;
            resolve(block);
            self.validateChain();
          }
          catch(error) {
            reject(error);
          }
          
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
          //<WALLET_ADDRESS>:${new Date().getTime().toString().slice(0,-3)}:starRegistry
          let message = `${address}:${new Date().getTime().toString().slice(0,-3)}:starRegistry`; 
          resolve(message);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
          let time = parseInt(message.split(':')[1]);
          let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));
          let timeDiffInMinutes = (currentTime - time) / 60;
          if (timeDiffInMinutes >= 5) return reject(Error('Maximum time elapsed is 5 minutes'));
          let valid = bitcoinMessage.verify(message, address, signature);
          if (valid) {
            let block = new BlockClass.Block({star:star,owner:address});
            let added = await self._addBlock(block);
            resolve(added);
          }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
           let block = self.chain.find( b => b.hash === hash);
           resolve(block ? block : null);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.find(p => p.height === height);
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let self = this;
        let stars = [];
        return new Promise(async (resolve, reject) => {
          let stars = [];
          for (let index = 1; index < self.chain.length; index++) {
            const block = self.chain[index];
            if (block.height === 0) return;
            let starObject = await block.getBData();
            if (starObject.owner === address)
              stars.push(starObject.star);
          }
          resolve(stars);
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
          for (let height = 1; height <= self.height; ++i){
            const block = await self.getBlockByHeight(height);
            let valid = await block.validate();
            if (!valid)
            {
              let hash = block.hash;
              let computedHash = block.computeHash();
              errorLog.push(Error(`Block with height ${height} is not valid:\n${hash} stored hash\n${computedHash} computed hash`));
            }
            let previousBlock = await self.getBlockByHeight(block.height -1);
            if (previousBlock.hash !== block.previousBlockHash)
              errorLog.push(Error(`Previous block hash does not match\n${block.previousBlockHash} block.previousBlockHash\n${previousBlock.hash} previousBlock.hash`));
          }
          resolve(errorLog);
        });
    }

}

module.exports.Blockchain = Blockchain;   