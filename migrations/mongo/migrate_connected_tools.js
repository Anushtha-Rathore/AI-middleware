// MongoDB migration script to restructure existing data
// Usage: Run manually via mongo shell or integrate into your deployment pipeline.

async function migrateConnectedTools(db) {
  const collections = ["configurations", "configuration_versions"];

  for (const coll of collections) {
    console.log(`Migrating collection: ${coll}`);
    try {
      const result = await db.collection(coll).updateMany(
        { connected_tools: { $exists: false } }, // Target documents without connected_tools
        [
          {
            $set: {
              connected_tools: {
                function_ids: { $ifNull: ["$function_ids", []] },
                connected_agents: { $ifNull: ["$connected_agents", {}] },
                built_in_tools: { $ifNull: ["$built_in_tools", []] },
                doc_ids: { $ifNull: ["$doc_ids", []] },
                variables_path: { $ifNull: ["$variables_path", {}] },
                variables_state: { $ifNull: ["$variables_state", {}] },
                web_search_filters: { $ifNull: ["$web_search_filters", []] },
                gtwy_web_search_filters: { $ifNull: ["$gtwy_web_search_filters", []] }
              }
            }
          },
          {
            $unset: [
              "function_ids",
              "connected_agents",
              "built_in_tools",
              "doc_ids",
              "variables_path",
              "variables_state",
              "web_search_filters",
              "gtwy_web_search_filters"
            ]
          }
        ]
      );
      console.log(`Completed migration for ${coll}. Modified ${result.modifiedCount} documents.`);
    } catch (e) {
      console.error(`Error migrating ${coll}:`, e);
    }
  }
}

module.exports = migrateConnectedTools;
