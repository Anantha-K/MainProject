# Worker Service

Reserved for the event-driven evolution of the system.

Future responsibilities:

- consume `ExecutionRequested` events from Kafka
- invoke the FaaS layer asynchronously
- emit `ExecutionCompleted` or `ExecutionFailed`
- support retries, dead-lettering, and backpressure
