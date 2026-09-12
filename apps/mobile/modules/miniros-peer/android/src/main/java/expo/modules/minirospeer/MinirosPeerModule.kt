package expo.modules.minirospeer

import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Candidate bridge only. Native transfer success never creates an application receipt. */
class MinirosPeerModule : Module() {
  private val serviceId = "com.miniros.peer.spike.v1"
  private var localContext = ""
  private var running = false
  private var generation = 0
  private val pending = mutableSetOf<String>()
  private val approved = mutableSetOf<String>()
  private val connected = mutableSetOf<String>()
  private val discovered = mutableSetOf<String>()
  private var connectionsClient: ConnectionsClient? = null
  private val client: ConnectionsClient get() = connectionsClient ?: Nearby.getConnectionsClient(requireNotNull(appContext.reactContext)).also { connectionsClient = it }
  private fun event(type: String, vararg values: Pair<String, Any>) = sendEvent("onPeerEvent", mapOf("type" to type, *values))
  private fun stopAll() {
    running = false
    generation++
    pending.clear(); approved.clear(); connected.clear(); discovered.clear()
    connectionsClient?.let { it.stopAdvertising(); it.stopDiscovery(); it.stopAllEndpoints() }
  }
  private fun payload(sessionGeneration: Int) = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
      if (!running || sessionGeneration != generation || !connected.contains(endpointId)) return
      val bytes = payload.asBytes()
      if (bytes == null || bytes.size > 16384) { client.cancelPayload(payload.id); event("error", "message" to "Incoming test exceeded the supported size."); return }
      event("bytes", "endpointId" to endpointId, "data" to bytes.toString(Charsets.UTF_8))
    }
    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
      if (sessionGeneration != generation) return
      if (update.status == PayloadTransferUpdate.Status.FAILURE) event("error", "message" to "Radio transfer failed. Saved tests remain pending.")
    }
  }
  private fun lifecycle(sessionGeneration: Int) = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      if (sessionGeneration != generation) return
      if (!running || pending.isNotEmpty() || approved.isNotEmpty() || connected.isNotEmpty() || !info.endpointName.matches(Regex("[a-f0-9]{64}"))) { client.rejectConnection(endpointId); return }
      pending.add(endpointId)
      event("verification", "endpointId" to endpointId, "context" to info.endpointName, "code" to info.authenticationDigits)
    }
    override fun onConnectionResult(endpointId: String, resolution: ConnectionResolution) {
      if (sessionGeneration != generation) return
      pending.remove(endpointId)
      if (running && approved.contains(endpointId) && resolution.status.isSuccess) {
        connected.add(endpointId); client.stopAdvertising(); client.stopDiscovery()
        event("connected", "endpointId" to endpointId)
      } else {
        approved.remove(endpointId); client.disconnectFromEndpoint(endpointId)
        event("disconnected", "endpointId" to endpointId)
      }
    }
    override fun onDisconnected(endpointId: String) {
      if (sessionGeneration != generation) return
      pending.remove(endpointId); approved.remove(endpointId); connected.remove(endpointId)
      event("disconnected", "endpointId" to endpointId)
    }
  }
  private fun discovery(sessionGeneration: Int) = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      if (running && sessionGeneration == generation && discovered.size < 8 && info.endpointName.matches(Regex("[a-f0-9]{64}"))) { discovered.add(endpointId); event("found", "endpointId" to endpointId, "context" to info.endpointName) }
    }
    override fun onEndpointLost(endpointId: String) { if (sessionGeneration != generation) return; discovered.remove(endpointId); event("lost", "endpointId" to endpointId) }
  }
  override fun definition() = ModuleDefinition {
    Name("MinirosPeer")
    Function("isAvailable") { true }
    Events("onPeerEvent")
    AsyncFunction("start") { context: String, role: String, promise: Promise ->
      stopAll()
      val requestedGeneration = generation
      require(context.matches(Regex("[a-f0-9]{64}"))) { "Invalid pairing binding" }
      require(role == "cashier" || role == "prep") { "Invalid test role" }
      localContext = context; running = true
      val task = if (role == "cashier") client.startAdvertising(context, serviceId, lifecycle(requestedGeneration), AdvertisingOptions.Builder().setStrategy(Strategy.P2P_POINT_TO_POINT).build())
        else client.startDiscovery(serviceId, discovery(requestedGeneration), DiscoveryOptions.Builder().setStrategy(Strategy.P2P_POINT_TO_POINT).build())
      task.addOnSuccessListener { if (requestedGeneration == generation) promise.resolve(null) else promise.reject("CANCELLED", "Search was cancelled.", null) }.addOnFailureListener { if (requestedGeneration == generation) stopAll(); promise.reject("NEARBY_START", "Cannot search. Check radio and nearby permissions in Settings.", it) }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("connect") { endpointId: String, promise: Promise ->
      require(running && discovered.contains(endpointId)) { "Unknown nearby endpoint" }
      client.requestConnection(localContext, endpointId, lifecycle(generation)).addOnSuccessListener { promise.resolve(null) }.addOnFailureListener { promise.reject("NEARBY_CONNECT", "Could not request the peer.", it) }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("confirm") { endpointId: String, accepted: Boolean, promise: Promise ->
      require(running && pending.contains(endpointId)) { "No pending code comparison" }
      val requestedGeneration = generation
      if (accepted) approved.add(endpointId) else pending.remove(endpointId)
      val task = if (accepted) client.acceptConnection(endpointId, payload(requestedGeneration)) else client.rejectConnection(endpointId)
      task.addOnSuccessListener { promise.resolve(null) }.addOnFailureListener { if (requestedGeneration == generation) { approved.remove(endpointId); pending.remove(endpointId) }; promise.reject("NEARBY_CONFIRM", "Could not confirm the peer.", it) }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("send") { endpointId: String, data: String, promise: Promise ->
      require(running && connected.contains(endpointId) && approved.contains(endpointId)) { "Peer is not authenticated" }
      val bytes = data.toByteArray(Charsets.UTF_8)
      require(bytes.size <= 16384) { "Payload is too large" }
      client.sendPayload(endpointId, Payload.fromBytes(bytes)).addOnSuccessListener { promise.resolve(null) }.addOnFailureListener { promise.reject("NEARBY_SEND", "Transfer attempt failed; no durable receipt was recorded.", it) }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("disconnect") { endpointId: String ->
      pending.remove(endpointId); approved.remove(endpointId); connected.remove(endpointId); client.disconnectFromEndpoint(endpointId)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stop") { stopAll() }.runOnQueue(Queues.MAIN)
    OnActivityEntersBackground { stopAll(); event("error", "message" to "Link paused while the app is in the background. Saved tests remain pending.") }
    OnDestroy { Handler(Looper.getMainLooper()).post { stopAll() } }
  }
}
