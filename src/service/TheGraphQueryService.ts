import { JSONRPCParams } from "json-rpc-2.0";
import { Client, cacheExchange, fetchExchange } from '@urql/core';
import {jsonRpcResult} from "../utils/Instrument";
import {GetStartNumber, UpdateStartNumber} from '../model/MongodbModels/SearchNumberModel'
import { remoteMinerRpcService } from "../rpc/RemoteMinerRpcService";
import { standardMinerRpcService } from "../rpc/StandardMinerRpcService";
import {notaryRpcService} from '../rpc/NotaryRpcService'
import { kmsRpcService } from "../rpc/KMSRpcService";
import {deviceService}  from '../rpc/DeviceService'
import {getAddress} from 'ethers'

import logger from "../config/log4js";
import config from "../config";


import stringify  from "json-stringify-sort"
import { keccak256 } from 'ethers';
const axios = require('axios');
import basex from "base-x";
var bs58 = basex('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')


export class TheGraphQueryService{
    
    //query the graph
    async theGraphQueryEvents(params: JSONRPCParams) {

        // try{
        //     logger.info("#~!@$%^&*")
        //     await handle_ArkreenMiner_events()
        //     await handle_ArkreenRECIssuance_REC_status()
        //     return {'success': true}
        // }catch(e:any){
        //     throw jsonRpcResult(e.code, e.message)
        // }

        ////sync mode
        // await _theGraphQueryEvents()

        ////async mode
        try{
            _theGraphQueryEvents().then(
                ()=>{logger.info("@@@@@@@@")}
            ).catch(
                (e)=>{logger.error(e)}
            );
            // await queryEvents()
            return {'success': true}
        }catch(e:any){
            throw jsonRpcResult(e.code, e.message)
        }
        
    }

}

export async function _theGraphQueryEvents(){
    try{
        logger.info("#~!@$%^&*")
        await handle_ArkreenMiner_events()
        await handle_ArkreenRECIssuance_REC_status()
        return {'success': true}
    }catch(e:any){
        throw jsonRpcResult(e.code, e.message)
    }
}

async function do_minerOnboarded(owner:string, miner:string){
    let params = {
        "owner":getAddress(owner),
        "miner":getAddress(miner)
    }

    try{
        let ret:any = await remoteMinerRpcService.requestActivateMiner(params)
    }catch(e:any){
        logger.error("<<< error in query rms_requestActivateMiner >>>\n", e.code, e.message)
    }
}

async function do_standardMinerOnboarded(owner:string, miner:string){
    let params = {
        "ownerAddress":getAddress(owner),
        "minerAddress":getAddress(miner)
    }

    try{
        let ret:any = await standardMinerRpcService.requestActivateMiner(params)
    }catch(e:any){
        logger.info("<<< error in query sdm_activateMinerByNftMintEvent >>>\n", e.code, e.message)
    }
}

async function do_transfer(transferInfo:{from:string, to:string, tokenId:number, miner:string, blockNumber:number, blockTimestamp:number, transactionHash:string}) {

    let data={
        minerAddress:transferInfo.miner,
        originalOwnerAddress:transferInfo.from,
        ownerAddress:transferInfo.to,
        nftTxHash:transferInfo.transactionHash
    }

    const opts = {fieldSorts:['minerAddress','originalOwnerAddress','ownerAddress', 'nftTxHash']};
    const message = stringify(data, opts);

    const digest = keccak256(Buffer.from(message))

    let raw_sig:any = await kmsRpcService.signByKeyId({ 
        // keyId: config['kmsAccount'].privileged_tx.id, 
        keyId: 'key_privileged_tx',
        hash: digest.slice(2)})
    // const sign_params = {
    //     keyId: 'key_privileged_tx',
    //     hash: digest.slice(2)
    // }

    // // console.log(params)

    // let raw_sig
    // try{
    //     raw_sig = await callRpc("http://localhost:4001/v1", "kms_signByKeyId", sign_params)
    //     console.log(raw_sig)
    // }catch(e:any){
    //     console.log(e)
    // }

    let rawSignature= raw_sig.r + raw_sig.s

    if (raw_sig.recid === 1) {
        rawSignature += '1c';
    } else {
        rawSignature += '1b';
    }

    data['signature'] = bs58.encode(Buffer.from(rawSignature,'hex'))

    try{
        const res = await deviceService.transferMiner(data)
        logger.info("call device service transferMiner returns:", res)
        
    }catch(e:any){
        logger.error("call device service transferMiner error:" , e)
    }
}

async function do_recrqquested(owner:any, tokenId:number){

    let params = {
        "owner":getAddress(owner),
        "tokenId": Number(tokenId)
    }

    try{
        let ret:any = await notaryRpcService.certifyRec(params)
        logger.info(ret)
    }catch(e:any){
        logger.error("<<< error in query rec_certifyRec >>>\n", e.code, e.message)
    }
}

async function handle_ArkreenMiner_events(){

    const client = new Client({
        url: config['the_graph_query_url_arkreen_miner'] ,
        exchanges: [cacheExchange, fetchExchange],
        });

    let continueBlock = 0

    try{
        continueBlock = await GetStartNumber('Arkreen_miner')
    }catch(e:any){
        logger.error("<<< error in handle_ArkreenMiner_events when query database >>>\n", e)
        return
    }

    // logger.info("++++++++++++++++++++++++++++++++++++++++++++++++")
    // console.log("continue block ", continueBlock)

    // gameMinerOnboardeds(
    //     where:{blockNumber_gte: ${continueBlock}}
    //     orderBy: blockNumber, orderDirection:asc
    // ){
    //     id
    //     owner
    //     miners
    //     blockNumber
    // }

    logger.info("query miner subgraph , continue block is : ", continueBlock)

    const onBoardQuery = `
            query {

                standardMinerOnboardeds(
                    where:{blockNumber_gte: ${continueBlock}}
                    orderBy: blockNumber, orderDirection:asc
                ){
                    id
                    miner
                    owner
                    blockNumber
                }

                minerOnboardeds(
                    where:{blockNumber_gte: ${continueBlock}}
                    orderBy: blockNumber, orderDirection:asc
                ){
                    id
                    owner
                    miner
                    blockNumber
                }

                transfers(
                    where: {blockNumber_gte: ${continueBlock},
                    from_not: "0x0000000000000000000000000000000000000000"}
                    orderBy: blockNumber, orderDirection:asc
                ) {
                    from
                    to
                    tokenId
                    miner
                    blockNumber
                    blockTimestamp
                    transactionHash
                    lastTransactionHash
                }

                _meta {
                    block {
                        number
                    }
                }
            }
            `

    let data:any = undefined
    try{
        data = await client.query(onBoardQuery, undefined).toPromise()
        if(data.data.minerOnboardeds.length > 0){
            logger.info("ArkreenMiner : Event minerOnboardeds count:", data.data.minerOnboardeds.length)
        }
        if(data.data.standardMinerOnboardeds.length > 0){
            logger.info("ArkreenMiner : Event standardMinerOnboardeds count:", data.data.standardMinerOnboardeds.length)
        }
        if(data.data.transfers.length > 0){
            logger.info("ArkreenMiner : Event Transfer count:", data.data.transfers.length)
        }
    }catch(e){
        logger.error("<<< query TheGraph error:>>> \n",JSON.stringify(e))
        return
    }

    data.data.minerOnboardeds.forEach((element: any )=> {
        do_minerOnboarded(element.owner, element.miner)
    });

    data.data.standardMinerOnboardeds.forEach((element: any )=> {
        do_standardMinerOnboarded(element.owner, element.miner)
    });

    // data.data.transfers.forEach((element:any )=> {
    //     // console.log(JSON.stringify(config))
    //     // do_minerOnboarded(utils.getAddress(element.owner), utils.getAddress(element.miner))
    //     // console.log(element)
    //     do_transfer({...element})
    // });

    for( const item of data.data.transfers){
        await do_transfer({...item})
    }

    // data.data.gameMinerOnboardeds.forEach((element: any) => {
    //     do_gameMinerOnboarded(element.owner)
    // });


    try{//sometime _meta is missing ,though query success
        data.data._meta
    }catch(e:any){
        logger.warn("<<< did not get _meta data >>>\n")
        logger.info(data)
        return
    }

    try{
        await UpdateStartNumber('Arkreen_miner', data.data._meta.block.number  + 1)
    }catch(e:any){
        logger.error("<<< error in handle_ArkreenMiner_events when write database >>>\n", e)
    }

}

async function handle_ArkreenRECIssuance_REC_status(){

    const client = new Client({
        url: config['the_graph_query_url_arkreen_rec_issuance'] ,
        exchanges: [cacheExchange, fetchExchange],
        });


    let continueBlock = 0

    try{
        continueBlock = await GetStartNumber('Arkreen_rec_issuence')
    }catch(e:any){
        logger.error("<<< error in handle_ArkreenMiner_events when query database >>>\n", e)
        return
    }

    const recsQuery = `
    query {

        recs(
            orderBy: blockNum, orderDirection: asc,
            where: {_change_block: {number_gte: ${continueBlock}}, status: Pending}
        ){
            id
            tokenId
            status
            owner
            issuer
            blockNum
          }

        _meta {
            block {
                number
            }
        }
    }
    `

    let data:any = undefined
    try{
        data = await client.query(recsQuery, undefined).toPromise()
    }catch(e){
        logger.error("<<< query TheGraph error >>>\n",JSON.stringify(e))
        return
    }

    try{//sometime _meta is missing ,though query success
        data.data._meta
    }catch(e:any){
        logger.warn("did not get _meta data")
        logger.info(data)
        return
    }

    if(data.data.recs.length > 0){
        logger.info("ArkreenRECIssuance: found status pending count:", data.data.recs.length)
    }

    //logger.info("ArkreenRECIssuance: scan blocks range " + continueBlock + " <------> " + data.data._meta.block.number)

    if(data.data.recs.length > 0){
        data.data.recs.forEach((element:any )=> {
            do_recrqquested(element.owner, element.tokenId)
        });
        continueBlock = data.data.recs[0].blockNum
    }else{
        continueBlock = data.data._meta.block.number + 1
    }

    try{
        await UpdateStartNumber('Arkreen_rec_issuence', continueBlock)
    }catch(e:any){
        logger.error("<<< error in handle_ArkreenRECIssuance_events when write database >>>\n")
        logger.info(JSON.stringify(e))
    }

}