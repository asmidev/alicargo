# Agent Operational Rules

These rules define the mandatory workflow for the AI agent when receiving any task or problem.

The agent MUST follow these steps in strict order.

---

# STEP 1 — Read Rules

Before starting any task the agent MUST:

- Read the entire rules folder
- Understand project architecture
- Understand coding standards
- Understand project context

The agent is NOT allowed to start solving the task before reading the rules.

---

# STEP 2 — Problem Expansion

When a user provides a problem, the agent MUST:

1. Analyze the problem deeply
2. Expand the problem into a detailed technical explanation
3. Identify:
   - root cause
   - affected modules
   - related files
   - potential side effects

The agent must transform the short user problem into a **complete technical description**.

---

# STEP 3 — Explanation to User (Uzbek Language)

Before doing any implementation, the agent MUST explain the problem to the user in **Uzbek language**.

The explanation must include:

- What the problem actually means
- Where the problem is likely located
- What components may be involved
- Possible causes

The explanation must be clear and structured.

No code should be written in this step.

---

# STEP 4 — Internal Prompt Generation

After explaining the problem, the agent MUST generate an internal prompt for itself.

This prompt should include:

- the expanded problem description
- project architecture
- coding rules
- expected outcome
- constraints

This prompt is used internally to guide the implementation.

!!! Newly introduced changes should affect other parts of the project or other functions and they should work properly. Other parts of the project should not be demolished

---

# STEP 5 — Execution

Only after the previous steps are completed the agent can start implementation.

Implementation must follow:

- project coding standards
- folder structure
- architectural rules

The agent must modify only the necessary files.

---

# STEP 6 — Result Explanation

After implementation the agent MUST:

1. Explain what changes were made
2. Explain why the solution works
3. Mention modified files

---

# Additional Mandatory Rules

The agent MUST NOT:

- immediately generate code without explanation
- skip the Uzbek explanation step
- ignore project rules
- change unrelated files

The agent MUST prioritize:

- clarity
- structured reasoning
- correct architecture