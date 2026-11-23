# Mission 001 — reference solutions

The complete, working solution to the **Guided track** is the reference implementation itself:

- Declarative: [../bicep/main.bicep](../bicep/main.bicep) and its
  [modules](../bicep/modules/).
- Imperative: [../cli/deploy.sh](../cli/deploy.sh), with
  [validate.sh](../cli/validate.sh) and [cleanup.sh](../cli/cleanup.sh).

Both are compiled/linted (Bicep) and shellcheck-clean (CLI). Read them only after attempting the
tasks yourself.

## Independent track (Track B) — reference answers

The Independent track asks for variants. The key differences from the Guided reference:

**Built-in Reader instead of a custom role (Bicep).** Reference the built-in role by its
well-known definition ID rather than hardcoding a full path:

```bicep
var readerRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'acdd72a7-3385-48ef-bd42-f606fba81ae7' // Reader (built-in, stable across tenants)
)
```

CLI equivalent: `az role assignment create --assignee-object-id <principalId> \
--assignee-principal-type ServicePrincipal --role Reader --scope <rg-id>`.

**Policy in audit mode.** Same definition; set the assignment's enforcement to audit. In Bicep,
use `enforcementMode: 'DoNotEnforce'` on the assignment, or set the rule's effect to `audit`. In
the CLI, `az policy assignment create ... --enforcement-mode DoNotEnforce`. Audit lets the
deployment through but records non-compliance — the safe way to roll a policy out.

**ReadOnly lock instead of CanNotDelete.** Change the lock `level` to `ReadOnly`. Predict first:
a `ReadOnly` lock blocks writes *and* some list/read operations (e.g. listing storage keys), which
is why you rarely want it on a whole resource group in production.

## Production Incident track (Track C)

The root-cause answers are in the mission's **Track C → Answers** block. The fixes, in short:

1. Widen the identity's access by the **smallest** step (a scoped built-in role with the needed
   `write` actions), never Owner-at-subscription.
2. Remove the `CanNotDelete` lock **deliberately** (auditable) before deleting — don't work
   around it.
3. Satisfy the policy (add the `costCenter` tag) or change the policy as a governance decision —
   don't disable it to push a change through.
