# Lesson: Introduction to Recursion (CS intro section)

Goal: students can read a simple recursive function and explain why it terminates.

## Concepts to cover

- **Base case** (core): the condition where the function stops calling itself. Without it, recursion never terminates.
- **Recursive case** (core): the function calls itself on a smaller/simpler input, moving toward the base case.
- **The call stack** (supporting): each recursive call is paused and waits for the one it made to return; calls unwind in reverse order.
- **Infinite recursion / stack overflow** (supporting): what goes wrong when the base case is missing or never reached.

## Worked example

Factorial: `factorial(n) = n * factorial(n - 1)`, with `factorial(1) = 1` as the base case. Trace `factorial(3)` step by step.

## Check for understanding

Ask an open question that makes students predict, e.g. "What happens if we remove the base case?"
