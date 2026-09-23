# Graph Report - /Users/kanganapong.s/Documents/Private/tradingview-api  (2026-09-22)

## Corpus Check
- Corpus is ~15,313 words - fits in a single context window. You may not need a graph.

## Summary
- 353 nodes · 481 edges · 32 communities (29 shown, 3 thin omitted)
- Extraction: 91% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Tests and Authentication|Tests and Authentication]]
- [[_COMMUNITY_HTTP API and Permissions|HTTP API and Permissions]]
- [[_COMMUNITY_Indicators and Protocol|Indicators and Protocol]]
- [[_COMMUNITY_Chart Data Routing|Chart Data Routing]]
- [[_COMMUNITY_Chart Session Operations|Chart Session Operations]]
- [[_COMMUNITY_Session Study Bridge|Session Study Bridge]]
- [[_COMMUNITY_WebSocket Client Lifecycle|WebSocket Client Lifecycle]]
- [[_COMMUNITY_Quote Session Lifecycle|Quote Session Lifecycle]]
- [[_COMMUNITY_Public API Examples|Public API Examples]]
- [[_COMMUNITY_Volume and Chart Tests|Volume and Chart Tests]]
- [[_COMMUNITY_Authenticated Test Setup|Authenticated Test Setup]]
- [[_COMMUNITY_Replay Indicator Example|Replay Indicator Example]]
- [[_COMMUNITY_Built-in Indicator Example|Built-in Indicator Example]]
- [[_COMMUNITY_Fake Replay Example|Fake Replay Example]]
- [[_COMMUNITY_Pine Permission Example|Pine Permission Example]]
- [[_COMMUNITY_Error Test Flow|Error Test Flow]]
- [[_COMMUNITY_Private Indicator Example|Private Indicator Example]]
- [[_COMMUNITY_Historical Data Example|Historical Data Example]]
- [[_COMMUNITY_Graphic Study Example|Graphic Study Example]]
- [[_COMMUNITY_Search API Surface|Search API Surface]]
- [[_COMMUNITY_Concurrent Study Example|Concurrent Study Example]]
- [[_COMMUNITY_Custom Timeframe Example|Custom Timeframe Example]]
- [[_COMMUNITY_Error Handling Example|Error Handling Example]]
- [[_COMMUNITY_Custom Chart Types|Custom Chart Types]]
- [[_COMMUNITY_Indicator Test Fixtures|Indicator Test Fixtures]]
- [[_COMMUNITY_Simple Chart Example|Simple Chart Example]]
- [[_COMMUNITY_Scanner and TA Requests|Scanner and TA Requests]]
- [[_COMMUNITY_Indicator Options|Indicator Options]]
- [[_COMMUNITY_Drawing Retrieval|Drawing Retrieval]]

## God Nodes (most connected - your core abstractions)
1. `TradingView.Client (websocket client)` - 20 edges
2. `Client.Session.Chart` - 16 edges
3. `genAuthCookies()` - 11 edges
4. `Requires SESSION+SIGNATURE env` - 11 edges
5. `chart.Study (session-scoped Study)` - 11 edges
6. `Client#parsePacket` - 10 edges
7. `Authenticated actions test suite` - 9 edges
8. `AllErrors test suite` - 8 edges
9. `Indicators test suite` - 8 edges
10. `Public endpoint (no auth)` - 8 edges

## Surprising Connections (you probably didn't know these)
- `AllErrors test suite` --semantically_similar_to--> `Errors example flow`  [INFERRED] [semantically similar]
  tests/allErrors.test.ts → examples/Errors.js
- `Authenticated actions test suite` --semantically_similar_to--> `AllPrivateIndicators example flow`  [INFERRED] [semantically similar]
  tests/authenticated.test.ts → examples/AllPrivateIndicators.js
- `Authenticated actions test suite` --semantically_similar_to--> `UserLogin example flow`  [INFERRED] [semantically similar]
  tests/authenticated.test.ts → examples/UserLogin.js
- `BuiltInIndicator test suite` --semantically_similar_to--> `BuiltInIndicator example flow`  [INFERRED] [semantically similar]
  tests/builtInIndicator.test.ts → examples/BuiltInIndicator.js
- `CustomChartTypes test suite` --semantically_similar_to--> `CustomChartType example flow`  [INFERRED] [semantically similar]
  tests/customChartTypes.test.ts → examples/CustomChartType.js

## Hyperedges (group relationships)
- **Websocket ingress: raw → parse → dispatch** — client_parsepacket, protocol_parsewspacket, concept_sessionlist, quotesession_ondata, chartsession_chart_ondata, chartsession_replay_ondata [INFERRED 0.95]
- **Websocket egress: send → format → queue → ws** — client_send, protocol_formatwspacket, client_sendqueue, concept_authflow [INFERRED 0.90]
- **Indicator creation pipeline** — pineindicator, builtinindicator, study_getinputs, chartstudy, concept_indicator_pipeline, concept_studylisteners [INFERRED 0.90]
- **Remote indicator fetch → PineIndicator instance → study** — misc_searchindicator, misc_getindicator, misc_getprivateindicators, pineindicator, chartstudy [INFERRED 0.85]
- **Chart session lifecycle: create → resolve → series → replay** — chartsession, chartsession_setmarket, chartsession_setseries, concept_replay_lifecycle, chartsession_replay_ondata [INFERRED 0.85]
- **Quote session lifecycle: create → subscribe symbols → dispatch** — quotesession, quotemarket, concept_symbollisteners, quotesession_ondata [INFERRED 0.85]
- **Strategy report decode: dataCompressed → parseCompressed → parseTrades** — chartstudy_listener, protocol_parsecompressed, protocol_parsedecodedcompressed, study_parsetrades, concept_compressed_report [INFERRED 0.85]
- **Client auth bootstrap: getUser → set_auth_token → logged** — client_constructor, misc_getuser, utils_genauthcookies, protocol_formatwspacket, concept_authflow [INFERRED 0.85]
- **Bridge object family (Client/Quote/Chart)** — concept_clientbridge, concept_quotesessionbridge, concept_chartsessionbridge [INFERRED 0.75]
- **Listener registry family (symbol/study)** — concept_symbollisteners, concept_studylisteners, concept_sessionlist [INFERRED 0.75]
- **Replay/step-through chart flow** — replaymode_replaymodetest, replaymode_mainflow, fakereplaymode_mainflow [INFERRED 0.85]
- **chart.setMarket + onSymbolLoaded pattern** — simplechart_simplecharttest, simplechart_mainflow, customcharttypes_customcharttypestest [INFERRED 0.85]
- **Client/Chart/Study error taxonomy** — allerrors_allerrorstest, errors_mainflow, getuserredirect_getuserredirecttest [INFERRED 0.75]

## Communities (32 total, 3 thin omitted)

### Community 0 - "Tests and Authentication"
Cohesion: 0.15
Nodes (38): AllErrors test suite, AllPrivateIndicators example flow, Requires SESSION+SIGNATURE env, Authenticated actions test suite, BuiltInIndicator class, BuiltInIndicator test suite, BuiltInIndicator example flow, chart.Study (session-scoped Study) (+30 more)

### Community 1 - "HTTP API and Permissions"
Cohesion: 0.07
Nodes (22): axios, { genAuthCookies }, PinePermManager, axios, builtInIndicList, fetchScanData(), { genAuthCookies }, getChartToken() (+14 more)

### Community 2 - "Indicators and Protocol"
Cohesion: 0.07
Nodes (19): matrix, TRANSLATOR, BuiltInIndicator, constructor(), { genSessionID }, getInputs(), graphic(), graphicParser (+11 more)

### Community 3 - "Chart Data Routing"
Cohesion: 0.09
Nodes (28): ChartSession chart onData handler, ChartSession replay onData handler, ChartSession#replayStep, ChartSession#setMarket, ChartSession#setSeries, ChartStudy study listener callback, Client#constructor, Client#handleEvent (+20 more)

### Community 4 - "Chart Session Operations"
Cohesion: 0.09
Nodes (7): ChartTypes, { genSessionID }, #handleError(), #handleEvent(), setMarket(), setSeries(), studyConstructor

### Community 5 - "Session Study Bridge"
Cohesion: 0.13
Nodes (23): BuiltInIndicator, ChartSession, ChartStudy, ChartStudy#setIndicator, ChartSessionBridge (session→study bridge), ClientBridge (session→client bridge), Indicator pipeline (create_study), QuoteSessionBridge (session→market bridge) (+15 more)

### Community 6 - "WebSocket Client Lifecycle"
Cohesion: 0.1
Nodes (10): chartSessionGenerator, constructor(), #handleError(), #handleEvent(), misc, protocol, quoteSessionGenerator, send() (+2 more)

### Community 7 - "Quote Session Lifecycle"
Cohesion: 0.15
Nodes (6): #handleError(), #handleEvent(), constructor(), { genSessionID }, getQuoteFields(), quoteMarketConstructor

### Community 8 - "Public API Examples"
Cohesion: 0.14
Nodes (8): TradingView, TradingView, TradingView, rsKeys, SEARCHES, BuiltInIndicator, miscRequests, PineIndicator

### Community 10 - "Volume and Chart Tests"
Cohesion: 0.18
Nodes (3): hists, VOL, volumeProfile

### Community 11 - "Authenticated Test Setup"
Cohesion: 0.2
Nodes (8): chart, checked, client, indicator, signature, testedIndicators, token, userIndicators

### Community 12 - "Replay Indicator Example"
Cohesion: 0.22
Nodes (6): chart, client, config, indicators, periods, TradingView

### Community 13 - "Built-in Indicator Example"
Cohesion: 0.33
Nodes (5): chart, client, TradingView, VOL, volumeProfile

### Community 14 - "Fake Replay Example"
Cohesion: 0.4
Nodes (4): chart, { Client }, times, Client

### Community 15 - "Pine Permission Example"
Cohesion: 0.4
Nodes (4): manager, newDate, { PinePermManager }, PinePermManager

### Community 16 - "Error Test Flow"
Cohesion: 0.4
Nodes (3): chart, client, Supertrend

### Community 17 - "Private Indicator Example"
Cohesion: 0.4
Nodes (4): chart, client, indicator, TradingView

### Community 18 - "Historical Data Example"
Cohesion: 0.4
Nodes (4): chart, client, SUPERTREND, TradingView

### Community 19 - "Graphic Study Example"
Cohesion: 0.4
Nodes (4): chart, client, STD, TradingView

### Community 20 - "Search API Surface"
Cohesion: 0.6
Nodes (5): searchIndicator (miscRequests), searchMarket (miscRequests), searchMarketV3 (miscRequests), Search example flow, Search + TA test suite

### Community 22 - "Custom Timeframe Example"
Cohesion: 0.5
Nodes (3): chart, client, TradingView

### Community 23 - "Error Handling Example"
Cohesion: 0.5
Nodes (3): client, tests, TradingView

### Community 24 - "Custom Chart Types"
Cohesion: 0.5
Nodes (3): chart, client, TradingView

### Community 25 - "Indicator Test Fixtures"
Cohesion: 0.5
Nodes (3): CipherB, indicators, SuperTrend

### Community 26 - "Simple Chart Example"
Cohesion: 0.5
Nodes (3): chart, client, TradingView

### Community 27 - "Scanner and TA Requests"
Cohesion: 0.67
Nodes (4): miscRequests.fetchScanData, miscRequests.getTA, miscRequests.searchMarket, miscRequests.searchMarketV3

## Ambiguous Edges - Review These
- `ChartStudy` → `graphicParse`  [AMBIGUOUS]
  src/chart/graphicParser.js · relation: shares_data_with
- `graphicParse` → `miscRequests.getDrawings`  [AMBIGUOUS]
  src/miscRequests.js · relation: conceptually_related_to

## Knowledge Gaps
- **121 isolated node(s):** `miscRequests`, `BuiltInIndicator`, `PineIndicator`, `client`, `chart` (+116 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `ChartStudy` and `graphicParse`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `graphicParse` and `miscRequests.getDrawings`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Client#constructor` connect `Chart Data Routing` to `Session Study Bridge`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `miscRequests`, `BuiltInIndicator`, `PineIndicator` to the rest of the system?**
  _121 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `HTTP API and Permissions` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Indicators and Protocol` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Chart Data Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._