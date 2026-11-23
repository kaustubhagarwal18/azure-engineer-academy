# Week 1 assessment — Manage Azure identities and governance

Timed, exam-style. Give yourself **20 minutes**, no notes. Answers are hidden; reveal each only
after you commit to one. Target ≥ 80% before moving to Week 2. Record your score in
[PROGRESS.md](../PROGRESS.md).

Domain weight on the real exam: **20–25%**.

---

**1.** RBAC permissions in Azure are:

- A. Additive, with no deny by default
- B. Most-restrictive-wins
- C. Evaluated top-down and stop at the first match

<details><summary>Answer</summary>A. RBAC is additive; effective access is the union of all assignments. (Separate *deny assignments* exist but are not created by normal role assignments.)</details>

**2.** You need a workload to authenticate to Azure Storage from a VM with no stored secret and
no credential rotation to manage. You choose a:

- A. Service principal with a client secret
- B. System-assigned managed identity
- C. Shared Access Signature in an environment variable

<details><summary>Answer</summary>B. A managed identity has no secret you manage; Azure rotates the credential. A system-assigned identity is tied to the VM's lifecycle.</details>

**3.** The inheritance order for scope (broadest → narrowest) is:

<details><summary>Answer</summary>Management group → subscription → resource group → resource. Assignments and policy inherit downward.</details>

**4.** A policy assigned at a **management group** applies to:

- A. Only that management group's direct child subscriptions
- B. All subscriptions and resources beneath it, including nested management groups
- C. Only resources tagged for it

<details><summary>Answer</summary>B. Policy inherits down the whole hierarchy.</details>

**5.** Which policy effect lets a non-compliant resource deploy but flags it for reporting?

<details><summary>Answer</summary>`audit` (or `auditIfNotExists`). `deny` blocks; `audit` records.</details>

**6.** True/False: a `CanNotDelete` lock prevents you from modifying the resource's settings.

<details><summary>Answer</summary>False. `CanNotDelete` blocks deletion only; you can still read and modify. `ReadOnly` blocks modifications (and some reads/list operations).</details>

**7.** You want new subscriptions in your organisation to automatically get a baseline tag policy
without reconfiguring each one. Where do you assign the policy?

<details><summary>Answer</summary>At a **management group** above the subscriptions, so inheritance applies it automatically.</details>

**8.** A custom role's `AssignableScopes` controls:

- A. What the role can do
- B. Where the role may be assigned
- C. Who can edit the role

<details><summary>Answer</summary>B. `Actions`/`NotActions` control what it can do; `AssignableScopes` controls where it may be assigned.</details>

**9 (scenario).** A user has **Owner** at a resource group and **Reader** at the subscription.
Can they create a storage account in that resource group?

<details><summary>Answer</summary>Yes. Owner at the RG grants full control there; the broader Reader doesn't reduce it (additive, no deny).</details>

**10 (command).** What's wrong, from a governance standpoint, with
`az role assignment create --assignee devteam@contoso.com --role Contributor --scope /subscriptions/<id>`?

<details><summary>Answer</summary>It grants Contributor over the **entire subscription**. If the team only works in one or two resource groups, scope the assignment to those RGs instead — least privilege.</details>

**11.** You create a resource group in a subscription where a `deny`-effect "require costCenter
tag" policy is assigned, and you forget the tag. Result?

<details><summary>Answer</summary>The deployment fails with `RequestDisallowedByPolicy`. Add the `costCenter` tag and retry.</details>

**12 (Bicep scope).** In a `targetScope = 'subscription'` Bicep file, how do you create a
resource that lives inside a resource group (e.g. a managed identity)?

<details><summary>Answer</summary>Use a **module** with `scope: <resourceGroupSymbolicName>`. Resources at a scope different from the file's `targetScope` must go through a module.</details>

---

### Scoring

| Correct | Verdict |
|---------|---------|
| 11–12 | Strong — proceed to Week 2 |
| 9–10 | Solid — review the ones you missed |
| ≤ 8 | Revisit Mission 001 and the study-guide sub-skills before moving on |

Note weak areas in [PROGRESS.md](../PROGRESS.md) so the (future) dashboard can recommend revision.
