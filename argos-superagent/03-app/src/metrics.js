import { p } from './util.js';

/** Attention, compute and cost accounting. Never mutates domain state. */
export class Metrics {
  constructor(config = {}) {
    this.config = {
      tokensPerCard: 640,
      cardsPerDecision: 3,
      sessionsAlive: 4,
      ...config
    };
    this.reset();
  }

  reset() {
    this.triggersIngested = 0;
    this.triggersFiltered = 0;
    this.evalBatches = 0;
    this.evalBatchSizes = [];
    this.routerDecisions = 0;
    this.routerDecisionsAvoided = 0;
    this.wouldAccept = 0;
    this.wouldSpeculate = 0;
    this.ticketsCreated = 0;
    this.speculativeStarted = 0;
    this.speculativePromoted = 0;
    this.speculativeDiscarded = 0;
    this.speculativeWasteTicks = 0;
    this.silenceSavings = 0;
    this.messagesSent = 0;
    this.wordsSent = 0;
    this.approvalsRequested = 0;
    this.acksSent = 0;
    this.resultsDelivered = 0;
    this.artifactsProduced = 0;
    this.evidenceFiles = 0;
    this.policyViolations = 0;
    this.watchdogFlags = 0;
    this.workerTicks = 0;
    this.completionTicks = [];
    this.cacheReadTokensEst = 0;
  }

  onTrigger(filtered) { this.triggersIngested++; if (filtered) this.triggersFiltered++; }
  onBatch(size) {
    this.evalBatches++; this.evalBatchSizes.push(size);
    this.routerDecisions += 1; // one batched Router decision, regardless of batch size
    this.cacheReadTokensEst += this.config.tokensPerCard * this.config.cardsPerDecision * this.config.sessionsAlive * size;
  }
  onDecision(outcome) { if (outcome === 'would_accept') this.wouldAccept++; }
  onExplicitDecision() { this.routerDecisions += 1; }
  onFastPath() { this.routerDecisionsAvoided++; }
  onReceipt(receipt) {
    if (receipt.status !== 'sent') return;
    this.messagesSent++;
    this.wordsSent += receipt.words || 0;
    if (receipt.purpose === 'acknowledgement') this.acksSent++;
    if (receipt.purpose === 'attention') this.approvalsRequested++;
    if (receipt.purpose === 'result') this.resultsDelivered++;
  }
  onCompletion(ticks) { this.completionTicks.push(ticks); }
  onArtifact() { this.artifactsProduced++; }
  onEvidenceFiles(n) { this.evidenceFiles += n; }

  attentionCost() {
    // Spec 06: 1 base + words/100 + 2 for an attention purpose + 3 for a
    // non-delegable approval decision. approvalsRequested counts attention receipts.
    return this.messagesSent + this.wordsSent / 100 + this.approvalsRequested * 5;
  }

  attentionPerUsefulResult() {
    return this.resultsDelivered ? Number((this.messagesSent / this.resultsDelivered).toFixed(2)) : 0;
  }

  /** Spec 02 §8: explicit, machine-checkable performance budgets. */
  performanceBudgets({ engineMs = [], eventCount = 1, pollPayloadBytes = 0, workerWallMs = 0, benchmarkMs = 0 } = {}) {
    const engineMsTotal = engineMs.reduce((a, b) => a + b, 0);
    const engineTickMsPer1kEvents = Number((engineMsTotal * 1000 / Math.max(1, eventCount)).toFixed(2));
    return {
      engineTickMsPer1kEvents, engineTickMs: Number((engineMsTotal / Math.max(1, engineMs.length)).toFixed(2)),
      eventCount, pollPayloadBytes, workerWallMs, benchmarkMs: Number(benchmarkMs.toFixed(2)),
      limits: { engineTickMs: 5, engineTickMsPer1kEvents: 5, pollPayloadBytes: 250000, workerWallMs: 2000, benchmarkMs: 1000 }
    };
  }

  assertPerformanceBudgets(measurements = {}) {
    const budgets = this.performanceBudgets(measurements);
    // Spec 02 §8: engine cost normalised to a 1,000-event log stays under
    // 5 ms. `engineTickMs` is the raw final projection; the normalised figure
    // is the normative budget and makes small/large runs comparable.
    const allPass = budgets.engineTickMsPer1kEvents <= budgets.limits.engineTickMsPer1kEvents
      && budgets.pollPayloadBytes <= budgets.limits.pollPayloadBytes
      && budgets.workerWallMs <= budgets.limits.workerWallMs
      && budgets.benchmarkMs <= budgets.limits.benchmarkMs;
    return { allPass, budgets };
  }

  snapshot() {
    return {
      triggersIngested: this.triggersIngested,
      triggersFiltered: this.triggersFiltered,
      evalBatches: this.evalBatches,
      avgBatchSize: this.evalBatchSizes.length ? Number((this.evalBatchSizes.reduce((a, b) => a + b, 0) / this.evalBatchSizes.length).toFixed(2)) : 0,
      routerDecisions: this.routerDecisions,
      routerDecisionsAvoided: this.routerDecisionsAvoided,
      evalBatchSizes: [...this.evalBatchSizes],
      wouldAccept: this.wouldAccept,
      wouldSpeculate: this.wouldSpeculate,
      ticketsCreated: this.ticketsCreated,
      speculativeStarted: this.speculativeStarted,
      speculativePromoted: this.speculativePromoted,
      speculativeDiscarded: this.speculativeDiscarded,
      speculativeWasteTicks: this.speculativeWasteTicks,
      silenceSavings: this.silenceSavings,
      messagesSent: this.messagesSent,
      wordsSent: this.wordsSent,
      approvalsRequested: this.approvalsRequested,
      acksSent: this.acksSent,
      resultsDelivered: this.resultsDelivered,
      artifactsProduced: this.artifactsProduced,
      evidenceFiles: this.evidenceFiles,
      policyViolations: this.policyViolations,
      watchdogFlags: this.watchdogFlags,
      workerTicks: this.workerTicks,
      attentionCost: Number(this.attentionCost().toFixed(2)),
      attentionPerUsefulResult: this.attentionPerUsefulResult(),
      messagesPerTrigger: this.triggersIngested ? Number((this.messagesSent / this.triggersIngested).toFixed(3)) : 0,
      cacheReadTokensEst: Math.round(this.cacheReadTokensEst),
      p50Completion: p(this.completionTicks, 0.5),
      p95Completion: p(this.completionTicks, 0.95),
      completions: this.completionTicks.length,
      completionTicks: [...this.completionTicks]
    };
  }
}
