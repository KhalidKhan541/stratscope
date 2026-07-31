/**
 * V1 router aggregation.
 *
 * Mounts all v1 route modules under a single Hono router.
 */

import { Hono } from "hono";
import type { Env } from "../../workers/env.js";
import { healthRoutes } from "./health.js";
import { authRoutes } from "./auth.js";
import { executionRoutes } from "./executions.js";
import { eventRoutes } from "./events.js";
import { evaluationRoutes } from "./evaluations.js";
import { reflectionRoutes } from "./reflections.js";
import { knowledgeRoutes } from "./knowledge.js";
import { recommendationRoutes } from "./recommendations.js";
import { feedbackRoutes } from "./feedback.js";
import { organizationRoutes } from "./organizations.js";
import { projectRoutes } from "./projects.js";
import { agentRoutes } from "./agents.js";
import { datasetRoutes } from "./datasets.js";
import { benchmarkRoutes } from "./benchmarks.js";
import { corpusRoutes } from "./corpora.js";
import { researchRoutes } from "./research.js";
import { consentRoutes } from "./consent.js";
import { researchAgentRoutes } from "./research-agents.js";
import { experimentRoutes } from "./experiments.js";
import { benchmarkRunRoutes } from "./benchmark-runs.js";
import { syntheticDatasetRoutes } from "./synthetic-datasets.js";
import { researchExportRoutes } from "./research-exports.js";
import { seeaExecutionRoutes } from "./seea-executions.js";
import { llmRoutes } from "./llm.js";

const v1 = new Hono<{ Bindings: Env }>();

v1.route("/auth", authRoutes);
v1.route("/health", healthRoutes);

// Authenticated routes
v1.route("/executions", executionRoutes);
v1.route("/events", eventRoutes);
v1.route("/evaluations", evaluationRoutes);
v1.route("/reflections", reflectionRoutes);
v1.route("/knowledge", knowledgeRoutes);
v1.route("/recommendations", recommendationRoutes);
v1.route("/feedback", feedbackRoutes);
v1.route("/organizations", organizationRoutes);
v1.route("/projects", projectRoutes);
v1.route("/agents", agentRoutes);
v1.route("/datasets", datasetRoutes);
v1.route("/benchmarks", benchmarkRoutes);
v1.route("/corpora", corpusRoutes);
v1.route("/research", researchRoutes);
v1.route("/consent", consentRoutes);
v1.route("/research-agents", researchAgentRoutes);
v1.route("/experiments", experimentRoutes);
v1.route("/benchmark-runs", benchmarkRunRoutes);
v1.route("/synthetic-datasets", syntheticDatasetRoutes);
v1.route("/research-exports", researchExportRoutes);
v1.route("/seea", seeaExecutionRoutes);
v1.route("/llm", llmRoutes);

export { v1 as v1Routes };
