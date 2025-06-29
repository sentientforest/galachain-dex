/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  GC_NETWORK_ID,
  TokenAllowance,
  TokenBalance,
  TokenBurn,
  TokenClass,
  TokenClassKey,
  TokenInstance,
  TokenInstanceKey
} from "@gala-chain/api";
import { users } from "@gala-chain/test";
import { createInstanceFn, createPlainFn } from "@gala-chain/test/lib/src/data/utils";
import BigNumber from "bignumber.js";

process.env.DEX_TOKEN_CLASS_COLLECTION = process.env.DEX_TOKEN_CLASS_COLLECTION ?? "TEST";
process.env.DEX_TOKEN_CLASS_CATEGORY = process.env.DEX_TOKEN_CLASS_CATEGORY ?? "Currency";
process.env.DEX_TOKEN_CLASS_TYPE = process.env.DEX_TOKEN_CLASS_TYPE ?? "DEX";
process.env.DEX_TOKEN_CLASS_ADDITIONAL_KEY =
  process.env.DEX_TOKEN_CLASS_ADDITIONAL_KEY ?? "client:6337024724eec8c292f0118d";

const tokenClassKeyPlain = createPlainFn({
  collection: process.env.DEX_TOKEN_CLASS_COLLECTION,
  category: process.env.DEX_TOKEN_CLASS_CATEGORY,
  type: process.env.DEX_TOKEN_CLASS_TYPE,
  additionalKey: process.env.DEX_TOKEN_CLASS_ADDITIONAL_KEY
});

const tokenClassPlain = createPlainFn({
  ...tokenClassKeyPlain(),
  description: "Generated via automated test suite.",
  decimals: 10,
  image: "https://app.gala.games/test-image-placeholder-url.png",
  isNonFungible: false,
  maxCapacity: new BigNumber(100000000000000),
  maxSupply: new BigNumber(100000000000000),
  name: "AUTOMATEDTESTCOIN",
  network: GC_NETWORK_ID,
  symbol: "AUTC",
  totalBurned: new BigNumber(0),
  totalMintAllowance: new BigNumber(0),
  totalSupply: new BigNumber(0),
  authorities: [users.admin.identityKey]
});

const tokenAllowancePlain = (txUnixTime: number) => ({
  ...tokenClassKeyPlain(),
  allowanceType: 4,
  quantity: new BigNumber(1000000000000),
  quantitySpent: new BigNumber(0),
  created: txUnixTime,
  expires: 0,
  instance: new BigNumber(0),
  grantedBy: users.admin.identityKey,
  grantedTo: users.admin.identityKey,
  uses: new BigNumber(1),
  usesSpent: new BigNumber(0)
});

const tokenBurnAllowancePlain = (txUnixTime: number) => ({
  ...tokenClassKeyPlain(),
  allowanceType: 6,
  quantity: new BigNumber(1),
  quantitySpent: new BigNumber(0),
  created: txUnixTime,
  expires: 0,
  instance: new BigNumber(0),
  grantedBy: users.testUser1.identityKey,
  grantedTo: users.testUser2.identityKey,
  uses: new BigNumber(1),
  usesSpent: new BigNumber(0)
});

const tokenBurnAllowanceUser3Plain = (txUnixTime: number) => ({
  ...tokenClassKeyPlain(),
  allowanceType: 6,
  quantity: new BigNumber(1),
  quantitySpent: new BigNumber(0),
  created: txUnixTime,
  expires: 0,
  instance: new BigNumber(0),
  grantedBy: users.testUser3.identityKey,
  grantedTo: users.testUser2.identityKey,
  uses: new BigNumber(1),
  usesSpent: new BigNumber(0)
});

const tokenMintAllowancePlain = (txUnixTime: number) => ({
  ...tokenClassKeyPlain(),
  allowanceType: 4,
  quantity: new BigNumber(1),
  quantitySpent: new BigNumber(0),
  created: txUnixTime,
  expires: 0,
  instance: new BigNumber(0),
  grantedBy: users.testUser1.identityKey,
  grantedTo: users.testUser2.identityKey,
  uses: new BigNumber(1),
  usesSpent: new BigNumber(0)
});

const tokenInstanceKeyPlain = createPlainFn({
  ...tokenClassKeyPlain(),
  instance: new BigNumber(0)
});

const tokenInstancePlain = createPlainFn({
  ...tokenInstanceKeyPlain(),
  isNonFungible: false
});

const tokenBalancePlain = createPlainFn({
  ...tokenClassKeyPlain(),
  owner: users.testUser1.identityKey,
  inUseHolds: [],
  lockedHolds: [],
  instanceIds: [],
  quantity: new BigNumber("1000")
});

const tokenBurnPlain = (txUnixTime: number) => ({
  ...tokenInstanceKeyPlain(),
  burnedBy: users.testUser1.identityKey,
  created: txUnixTime,
  quantity: new BigNumber(1)
});

const tokenBurnCounterPlain = (
  txUnixTime: number,
  timeKey: string,
  epoch: string,
  totalKnownBurnsCount: BigNumber
) => ({
  ...tokenBurnPlain(txUnixTime),
  timeKey,
  epoch,
  totalKnownBurnsCount
});

export default {
  tokenClassKeyPlain,
  tokenClassKey: createInstanceFn(TokenClassKey, tokenClassKeyPlain()),
  tokenClassPlain: tokenClassPlain,
  tokenClass: createInstanceFn(TokenClass, tokenClassPlain()),
  tokenAllowancePlain,
  tokenAllowance: createInstanceFn(TokenAllowance, tokenAllowancePlain(1)),
  tokenBurnAllowancePlain,
  tokenBurnAllowance: createInstanceFn(TokenAllowance, tokenBurnAllowancePlain(1)),
  tokenBurnAllowanceUser3Plain,
  tokenBurnAllowanceUser3: createInstanceFn(TokenAllowance, tokenBurnAllowanceUser3Plain(1)),
  tokenMintAllowancePlain,
  tokenMintAllowance: createInstanceFn(TokenAllowance, tokenMintAllowancePlain(1)),
  tokenInstanceKeyPlain,
  tokenInstanceKey: createInstanceFn(TokenInstanceKey, tokenInstanceKeyPlain()),
  tokenInstancePlain,
  tokenInstance: createInstanceFn(TokenInstance, tokenInstancePlain()),
  tokenBalancePlain,
  tokenBalance: createInstanceFn(TokenBalance, tokenBalancePlain()),
  tokenBurnPlain,
  tokenBurn: createInstanceFn(TokenBurn, tokenBurnPlain(1)),
  tokenBurnCounterPlain
};
