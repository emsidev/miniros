import ExpoModulesCore
import Foundation
#if MINIROS_EP02_PEER
import NearbyConnections

/** Native candidate. Receipts are created only by the TypeScript SQLite receiver. */
public final class MinirosPeerModule: Module, AdvertiserDelegate, DiscovererDelegate, ConnectionManagerDelegate {
  private let serviceID = "com.miniros.peer.spike.v1"
  private var manager: ConnectionManager?
  private var advertiser: Advertiser?
  private var discoverer: Discoverer?
  private var localContext = Data()
  private var contexts: [EndpointID: String] = [:]
  private var pending: [EndpointID: (Bool) -> Void] = [:]
  private var approved = Set<EndpointID>()
  private var connected = Set<EndpointID>()
  private var running = false
  private var generation = 0

  public func definition() -> ModuleDefinition {
    Name("MinirosPeer")
    Function("isAvailable") { true }
    Events("onPeerEvent")
    AsyncFunction("start") { (context: String, role: String, promise: Promise) in
      self.stopAll()
      let generation = self.generation
      guard context.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil, role == "cashier" || role == "prep" else { promise.reject("PAIRING_CONTEXT", "Invalid test pairing scope"); return }
      self.localContext = Data(context.utf8)
      self.running = true
      let manager = ConnectionManager(serviceID: self.serviceID, strategy: .pointToPoint)
      manager.delegate = self; self.manager = manager
      let completion: (Error?) -> Void = { error in
        guard generation == self.generation else { promise.reject("CANCELLED", "Search was cancelled."); return }
        if let error { self.stopAll(); promise.reject("NEARBY_START", "Check Bluetooth and Local Network in Settings, then retry.", error) }
        else { promise.resolve(nil) }
      }
      // Do not enable WebRTC: this spike must not use a hidden WAN data channel.
      let mediums: Set<Medium> = [.bluetooth, .ble, .wifiLAN, .wifiHotspot, .wifiDirect, .awdl]
      if role == "cashier" {
        let advertiser = Advertiser(connectionManager: manager)
        advertiser.delegate = self; self.advertiser = advertiser
        advertiser.startAdvertising(using: self.localContext, mediums: mediums, completionHandler: completion)
      } else {
        let discoverer = Discoverer(connectionManager: manager)
        discoverer.delegate = self; self.discoverer = discoverer
        discoverer.startDiscovery(mediums: mediums, completionHandler: completion)
      }
    }.runOnQueue(.main)
    AsyncFunction("connect") { (endpoint: String, promise: Promise) in
      guard self.running, self.contexts[endpoint] != nil, let discoverer = self.discoverer else { promise.reject("UNKNOWN_PEER", "Search for this test phone again."); return }
      discoverer.requestConnection(to: endpoint, using: self.localContext) { error in
        if let error { promise.reject("NEARBY_CONNECT", "Could not request this test phone.", error) } else { promise.resolve(nil) }
      }
    }.runOnQueue(.main)
    AsyncFunction("confirm") { (endpoint: String, accept: Bool, promise: Promise) in
      guard self.running, let handler = self.pending.removeValue(forKey: endpoint) else { promise.reject("NO_CHALLENGE", "No pending comparison for this phone."); return }
      if accept { self.approved.insert(endpoint) }
      handler(accept); promise.resolve(nil)
    }.runOnQueue(.main)
    AsyncFunction("send") { (endpoint: String, raw: String, promise: Promise) in
      let bytes = Data(raw.utf8)
      guard self.running, self.connected.contains(endpoint), self.approved.contains(endpoint), bytes.count <= 16384, let manager = self.manager else { promise.reject("NOT_AUTHENTICATED", "Connect and compare the code before sending."); return }
      _ = manager.send(bytes, to: [endpoint]) { error in
        if let error { promise.reject("NEARBY_SEND", "Transfer attempt failed. Saved tests remain pending.", error) }
        else { promise.resolve(nil) } // SDK accepted send; this is NOT a durable receipt.
      }
    }.runOnQueue(.main)
    AsyncFunction("disconnect") { (endpoint: String) in
      self.pending.removeValue(forKey: endpoint)?(false)
      self.approved.remove(endpoint); self.connected.remove(endpoint)
      self.manager?.disconnect(from: endpoint)
    }.runOnQueue(.main)
    AsyncFunction("stop") { self.stopAll() }.runOnQueue(.main)
    OnAppEntersBackground { self.stopAll(); self.emit("error", ["message": "Paused in the background. Reconnect on return; saved tests remain pending."]) }
    OnDestroy { self.stopAll() }
  }
  private func emit(_ type: String, _ values: [String: Any]) { var event = values; event["type"] = type; sendEvent("onPeerEvent", event) }
  private func stopAll() {
    running = false
    generation += 1
    let waiting = pending; pending.removeAll(); waiting.values.forEach { $0(false) }
    for endpoint in connected.union(approved).union(contexts.keys) { manager?.disconnect(from: endpoint) }
    connected.removeAll(); approved.removeAll(); contexts.removeAll()
    advertiser?.stopAdvertising(); discoverer?.stopDiscovery()
    advertiser = nil; discoverer = nil; manager?.delegate = nil; manager = nil
  }
  public func advertiser(_ advertiser: Advertiser, didReceiveConnectionRequestFrom endpointID: EndpointID, with context: Data, connectionRequestHandler: @escaping (Bool) -> Void) {
    guard running, advertiser === self.advertiser, contexts.isEmpty, connected.isEmpty, approved.isEmpty, pending.isEmpty, let binding = String(data: context, encoding: .utf8), binding.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { connectionRequestHandler(false); return }
    contexts[endpointID] = binding
    // This advances to mandatory verification below; it does not authenticate or connect.
    connectionRequestHandler(true)
  }
  public func discoverer(_ discoverer: Discoverer, didFind endpointID: EndpointID, with context: Data) {
    guard running, discoverer === self.discoverer, contexts.count < 8, let binding = String(data: context, encoding: .utf8), binding.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { return }
    contexts[endpointID] = binding; emit("found", ["endpointId": endpointID, "context": binding])
  }
  public func discoverer(_ discoverer: Discoverer, didLose endpointID: EndpointID) { guard discoverer === self.discoverer else { return }; contexts.removeValue(forKey: endpointID); emit("lost", ["endpointId": endpointID]) }
  public func connectionManager(_ connectionManager: ConnectionManager, didReceive verificationCode: String, from endpointID: EndpointID, verificationHandler: @escaping (Bool) -> Void) {
    guard running, connectionManager === manager, pending.isEmpty, approved.isEmpty, connected.isEmpty, let binding = contexts[endpointID] else { verificationHandler(false); return }
    pending[endpointID] = verificationHandler
    emit("verification", ["endpointId": endpointID, "context": binding, "code": verificationCode])
  }
  public func connectionManager(_ connectionManager: ConnectionManager, didChangeTo state: ConnectionState, for endpointID: EndpointID) {
    guard running, connectionManager === manager else { return }
    switch state {
    case .connected:
      guard approved.contains(endpointID) else { connectionManager.disconnect(from: endpointID); return }
      connected.insert(endpointID); advertiser?.stopAdvertising(); discoverer?.stopDiscovery()
      emit("connected", ["endpointId": endpointID])
    case .disconnected, .rejected:
      pending.removeValue(forKey: endpointID)?(false); approved.remove(endpointID); connected.remove(endpointID)
      emit("disconnected", ["endpointId": endpointID])
    case .connecting: break
    @unknown default: connectionManager.disconnect(from: endpointID)
    }
  }
  public func connectionManager(_ connectionManager: ConnectionManager, didReceive data: Data, withID payloadID: PayloadID, from endpointID: EndpointID) {
    guard running, connectionManager === manager, connected.contains(endpointID), data.count <= 16384, let raw = String(data: data, encoding: .utf8) else { return }
    emit("bytes", ["endpointId": endpointID, "data": raw])
  }
  public func connectionManager(_ connectionManager: ConnectionManager, didReceive stream: InputStream, withID payloadID: PayloadID, from endpointID: EndpointID, cancellationToken token: CancellationToken) { token.cancel() }
  public func connectionManager(_ connectionManager: ConnectionManager, didStartReceivingResourceWithID payloadID: PayloadID, from endpointID: EndpointID, at localURL: URL, withName name: String, cancellationToken token: CancellationToken) { token.cancel() }
  public func connectionManager(_ connectionManager: ConnectionManager, didReceiveTransferUpdate update: TransferUpdate, from endpointID: EndpointID, forPayload payloadID: PayloadID) {
    if case .failure = update { emit("error", ["message": "Radio transfer failed. Saved tests remain pending."]) }
  }
}

#else
/** Keeps the ordinary native shell buildable without enabling the EP02 dependency. */
public final class MinirosPeerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MinirosPeer")
    Function("isAvailable") { false }
  }
}
#endif
