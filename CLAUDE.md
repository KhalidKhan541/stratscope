# CLAUDE.md

# StratScope Engineering Constitution

Version: 1.0

Status: Repository Constitution

Last Updated: July 2026

---

# Mission

StratScope is building the world's first AI Execution Intelligence Platform.

We are not building another AI agent framework.

We are building the infrastructure layer that allows AI systems to be observable, explainable, replayable, measurable, continuously improving, and enterprise-ready.

Our core innovation is the **Execution Intelligence Operating System (EIOS)**.

Every AI execution becomes immutable organizational intelligence.

---

# Vision

Artificial Intelligence is moving from experimentation to production.

Organizations will soon operate thousands of autonomous AI systems.

Today's tooling focuses on creating AI.

StratScope focuses on operating AI.

Our goal is to become the execution layer every production AI system depends upon.

---

# Product Category

AI Execution Intelligence Platform

Never describe StratScope as:

- Chatbot Platform
- AI Agent Builder
- Workflow Builder
- LLM Wrapper

Instead use:

AI Execution Intelligence Platform

Execution Intelligence Operating System

Execution Intelligence Infrastructure

---

# Core Philosophy

Everything revolves around one concept.

Execution.

Everything begins with an execution.

Every execution creates events.

Events create artifacts.

Artifacts generate knowledge.

Knowledge creates learning.

Learning creates optimization.

Optimization generates recommendations.

Recommendations generate datasets.

Datasets generate benchmarks.

Benchmarks generate corpora.

Corpora power research.

Nothing is ever lost.

Nothing is overwritten.

History is immutable.

---

# The Golden Rule

Never optimize for writing code.

Optimize for building infrastructure that will survive ten years of growth.

Choose architecture over convenience.

Choose clarity over cleverness.

Choose maintainability over shortcuts.

---

# Engineering Principles

## Single Responsibility

Every service owns exactly one responsibility.

---

## Strong Boundaries

Services communicate only through APIs or Events.

Never call another service's internal implementation.

Never access another service's database.

---

## Event Sourcing

Execution history is immutable.

Never UPDATE historical execution data.

Never DELETE execution history.

Everything important becomes an event.

---

## Immutable Artifacts

Every pipeline stage creates a new immutable artifact.

Artifacts are never modified.

---

## Version Everything

Version:

SDK

Protocol

Pipeline

Artifacts

Events

Database Schema

API

Never introduce breaking changes without versioning.

---

## Cloud Native

Everything should be stateless whenever possible.

Background work must use queues.

Workers should return quickly.

Long-running work belongs in asynchronous processing.

---

# Execution Intelligence Operating System (EIOS)

The EIOS is the heart of StratScope.

Execution Lifecycle

Created

↓

Accepted

↓

Normalized

↓

Evaluated

↓

Reflected

↓

Knowledge Extracted

↓

Learned

↓

Optimized

↓

Recommendation Published

↓

Research Dataset Built

↓

Benchmark Created

↓

Corpus Assembled

↓

Research API Available

↓

Archived

Every stage produces immutable artifacts.

Every stage emits events.

Every stage can be replayed.

---

# Constitutional Specifications

Every subsystem must follow these specifications.

EXS

Execution Specification

Defines the canonical execution object.

---

ARS

Artifact Specification

Defines immutable artifacts.

---

EVS

Event Specification

Defines event contracts.

---

SDS

SDK Specification

Defines every SDK.

No implementation may violate these specifications.

---

# Technology Stack

Frontend

Next.js

TypeScript

React

Tailwind CSS

Backend

Cloudflare Workers

Hono

TypeScript

TurboRepo

Database

Cloudflare D1

Object Storage

Cloudflare R2

Cache

Cloudflare KV

Queues

Cloudflare Queues

State Coordination

Cloudflare Durable Objects (only when justified)

Vector Store

Cloudflare Vectorize

Authentication

Clerk

Billing

Stripe

AI

Groq

Provider abstraction required.

Future providers

OpenAI

Anthropic

Gemini

Ollama

OpenRouter

---

# Architecture

Use Clean Architecture.

API Layer

↓

Application Layer

↓

Domain Layer

↓

Infrastructure Layer

↓

Persistence Layer

Dependencies only point inward.

Never violate dependency direction.

---

# Domain Objects

Execution

Artifact

Evaluation

Reflection

Knowledge

Learning

Recommendation

Organization

Project

Agent

User

APIKey

Experiment

Feedback

Dataset

Benchmark

Corpus

Every object has:

Unique ID

Version

Created Timestamp

Metadata

---

# Service Boundaries

Execution Service

Responsible only for execution ingestion.

Evaluation Service

Responsible only for evaluation.

Reflection Service

Responsible only for reflection.

Knowledge Service

Responsible only for knowledge extraction.

Learning Service

Responsible only for learning.

Optimization Service

Responsible only for recommendations.

Analytics Service

Responsible only for reporting.

Dataset Builder Service

Responsible only for building datasets from execution history.

Benchmark Builder Service

Responsible only for creating and running benchmarks.

Corpus Service

Responsible only for managing research corpora.

Dataset Export Service

Responsible only for exporting datasets in multiple formats.

No service performs another service's responsibility.

---

# API Rules

REST

Versioned

/v1/

Every endpoint must have:

Validation

Authentication

Authorization

Typed DTOs

OpenAPI documentation

Consistent error schema

Cursor pagination where applicable

---

# Event Rules

Everything important emits events.

Examples

ExecutionAccepted

ExecutionStarted

ExecutionCompleted

EvaluationGenerated

ReflectionGenerated

KnowledgeExtracted

LearningCompleted

RecommendationPublished

DatasetCreated

DatasetValidated

DatasetExported

BenchmarkCreated

BenchmarkCompleted

CorpusPublished

Events are append-only.

Never mutate events.

---

# Database Rules

Cloudflare D1 stores structured data.

R2 stores large payloads.

KV stores cache/configuration.

Vectorize stores embeddings.

Queues handle asynchronous work.

Never store embeddings in D1.

Never store giant prompts in SQL.

---

# AI Provider Rules

Never couple business logic to Groq.

Always use an interface.

interface LLMProvider

Future providers should require only a new adapter.

---

# Code Quality

Strict TypeScript.

No any.

No magic strings.

No duplicated logic.

Small files.

Meaningful names.

Dependency injection.

Composition over inheritance.

SOLID.

Domain Driven Design.

Hexagonal Architecture where appropriate.

---

# Testing

Every module requires:

Unit Tests

Integration Tests

Contract Tests

No production business logic without tests.

---

# Documentation

Every public interface requires documentation.

Every service requires:

README

Architecture Diagram

Sequence Diagram

API Documentation

---

# Logging

Use structured logging.

Never console.log in production code.

Every log includes:

Trace ID

Execution ID

Organization ID

Project ID

Service Name

Timestamp

---

# Security

Every request requires authentication.

Organization isolation is mandatory.

Never leak data across tenants.

API keys are hashed.

Secrets never enter source control.

Sensitive fields support redaction.

---

# Performance

Execution ingestion should complete quickly.

Heavy work must be asynchronous.

Workers should avoid unnecessary blocking.

Optimize for throughput before micro-optimizations.

---

# Repository Structure

/apps

dashboard

api

/sdk

typescript

python

/packages

core

domain

protocol

events

artifacts

shared

/ui

/services

execution

evaluation

reflection

knowledge

learning

optimization

analytics

dataset_builder

benchmark_builder

corpus

dataset_export

/docs

Volumes 1–15

Architecture

ADR

Protocol

/scripts

Deployment

Migrations

Utilities

---

# Development Workflow

Before implementing any feature:

Understand the relevant documentation.

Identify the affected bounded context.

Design interfaces first.

Implement domain logic.

Write tests.

Generate documentation.

Review architecture.

Only then continue.

---

# Implementation Roadmap (MUST FOLLOW)

Development proceeds in this exact order.

## Phase 1 — Core Foundation

Build the foundation of the platform.

Deliverables:

- Monorepo structure
- Package management
- Cloudflare configuration
- Shared packages
- Core domain models
- Authentication
- Organizations
- Projects
- Users
- API Keys
- Clerk integration
- Database migrations
- CI/CD
- Environment management
- Logging
- OpenTelemetry setup
- Error handling framework

Nothing else should be built before this foundation is complete.

---

## Phase 2 — Execution Service

Build the execution ingestion system.

Deliverables:

- Execution API
- Execution Specification (EXS)
- Immutable execution records
- Event publishing
- Queue integration
- Trace IDs
- Replay metadata
- Artifact generation
- Execution repository
- Execution lifecycle
- Event Store

This is the first real business capability.

---

## Phase 3 — Execution Intelligence Operating System (EIOS)

Build the orchestration engine.

Deliverables:

- Pipeline orchestrator
- Stage scheduler
- Normalization
- Artifact repository
- Pipeline versioning
- Replay engine
- Plugin architecture
- Execution lifecycle management
- Event dispatcher

No AI intelligence yet.

Only orchestration.

---

## Phase 4 — Dashboard

Prove execution intelligence has value.

Deliverables:

Overview Dashboard

Execution Explorer

Execution Timeline

Artifacts Viewer

Cost Analytics

Latency Analytics

Token Usage

Pipeline Status

Search

Filtering

This dashboard validates the platform.

---

## Phase 5 — Intelligence Layer

Build intelligence on top of execution history.

Modules

Evaluation Engine

Reflection Engine

Knowledge Extraction

Learning Engine

Optimization Engine

Recommendations

Everything consumes Execution Artifacts.

Nothing bypasses EIOS.

---

## Phase 6 — Research Intelligence

Build the research intelligence layer.

Deliverables:

- Dataset Builder
- Dataset Versioning
- Dataset Validation
- Dataset Registry
- Dataset Export (JSONL, Parquet, CSV, Arrow, REST)
- Benchmark Builder
- Benchmark Runner
- Corpus Builder
- Experiment Registry
- Research API
- Research Dashboard

Every dataset is versioned, immutable, searchable, and exportable.

---

## Phase 7 — Enterprise

Only after the platform is stable.

RBAC

Organizations

Audit Logs

Enterprise Settings

SSO

Compliance

Billing

Governance

Exports

Webhooks

---

# Final Principle

Every decision should answer one question.

"Will this architecture still make sense when StratScope processes one billion AI executions?"

If the answer is no,

redesign it.