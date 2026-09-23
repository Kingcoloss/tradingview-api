---
type: "query"
date: "2026-09-22T07:32:01.295026+00:00"
question: "Trace the code story starting from main.js"
contributor: "graphify"
source_nodes: ["main.js", "client.js", "session.js", "session.js", "protocol.js", "miscRequests.js"]
---

# Q: Trace the code story starting from main.js

## Answer

main.js is a 5-require barrel: it spreads miscRequests (HTTP API) into module.exports then attaches Client, BuiltInIndicator, PineIndicator, PinePermManager. Story branch A (websocket): Client constructor (src/client.js:228) opens the socket, bootstraps auth by unshifting a set_auth_token packet (real authToken from misc.getUser, else literal unauthorized_user_token) and sets #logged. send() (L200) formats via protocol.formatWSPacket into #sendQueue; sendQueue() (L206) drains only when isOpen && #logged. #parsePacket (L157) is the single dispatcher: bare number = ping echoed as ~h~n, protocol_error = fatal close, otherwise packet.p[0] is a session id routed to #sessions[sessionID].onData; pre-login packets are emitted as the logged event. Session factories consume a ClientBridge {sessions, send}; ChartSession matches study packets by packet.data[1], sets #infos on symbol_resolved and #periods on timescale_update/du. Study.getInputs branches on instanceof PineIndicator vs BuiltInIndicator to shape create_study/modify_study payloads. Story branch B (HTTP): miscRequests.js uses axios for search/TA/indicator-facade/drawings endpoints, sharing genAuthCookies for private data. Errors are callback-based: #handleError calls #handleEvent (EXTRACTED edge) or falls back to console.error when no error listener is registered.

## Source Nodes

- main.js
- client.js
- session.js
- session.js
- protocol.js
- miscRequests.js