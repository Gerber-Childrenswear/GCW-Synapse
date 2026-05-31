import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  Card,
  Divider,
  Frame,
  IndexTable,
  Layout,
  Page,
  Tabs,
  Text
} from "@shopify/polaris";
import { getRuntimeRecent, getRuntimeSummary, getValidationModel, type RuntimeSummary } from "./api";
import "./app.css";

type TabKey =
  | "dashboard"
  | "event-volume"
  | "health"
  | "last-sync"
  | "data-layer-debugger"
  | "live-payload"
  | "validation"
  | "migration"
  | "commerce-shield";

const TAB_CONFIG: Array<{ id: TabKey; content: string }> = [
  { id: "dashboard", content: "Dashboard" },
  { id: "event-volume", content: "Event Volume" },
  { id: "health", content: "Health Status" },
  { id: "last-sync", content: "Last Sync" },
  { id: "data-layer-debugger", content: "Data Layer Debugger" },
  { id: "live-payload", content: "Live Payload Viewer" },
  { id: "validation", content: "Validation" },
  { id: "migration", content: "Migration Assistant" },
  { id: "commerce-shield", content: "Commerce Shield" }
];

function PlatformValidationCard({ model }: { model: unknown }) {
  const health = useMemo(() => {
    if (!model || typeof model !== "object") {
      return [] as string[];
    }

    return ["Google", "Meta", "TikTok", "Pinterest", "Bloomreach", "GA4"];
  }, [model]);

  return (
    <Card>
      <Text as="h3" variant="headingMd">
        Platform Validation
      </Text>
      <Divider />
      {health.map((platform) => (
        <div key={platform} className="spacerTop12">
          <Badge tone="success">{platform}</Badge>
        </div>
      ))}
    </Card>
  );
}

export default function App() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [summary, setSummary] = useState<RuntimeSummary | null>(null);
  const [recent, setRecent] = useState<unknown[]>([]);
  const [model, setModel] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getRuntimeSummary(), getRuntimeRecent(50), getValidationModel()])
      .then(([runtimeSummary, runtimeRecent, validationModel]) => {
        setSummary(runtimeSummary);
        setRecent(runtimeRecent);
        setModel(validationModel);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load Synapse data");
      });
  }, []);

  const activeTab = TAB_CONFIG[selectedTab]?.id ?? "dashboard";

  return (
    <Frame>
      <Page title="GCW Synapse" subtitle="Production control plane for Gerber Childrenswear">
        {error ? (
          <Banner tone="critical" title="Unable to load data">
            <p>{error}</p>
          </Banner>
        ) : null}

        <Tabs tabs={TAB_CONFIG} selected={selectedTab} onSelect={setSelectedTab} fitted />

        <Layout>
          <Layout.Section>
            <Card>
              <Text as="h2" variant="headingLg">
                {TAB_CONFIG[selectedTab]?.content}
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Active view: {activeTab}
              </Text>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <Text as="h3" variant="headingMd">
                Event Volume
              </Text>
              <div className="spacerTop12">
                <Text as="p">Total: {summary?.telemetry.total ?? 0}</Text>
                <Text as="p">Forwarded: {summary?.telemetry.forwarded ?? 0}</Text>
                <Text as="p">Suppressed: {summary?.telemetry.suppressed ?? 0}</Text>
                <Text as="p">Duplicate: {summary?.telemetry.duplicate ?? 0}</Text>
              </div>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <Text as="h3" variant="headingMd">
                Commerce Shield
              </Text>
              <div className="spacerTop12">
                <Text as="p">Human Sessions: {summary?.commerce_shield.human_sessions ?? 0}</Text>
                <Text as="p">Bot Sessions: {summary?.commerce_shield.bot_sessions ?? 0}</Text>
                <Text as="p">Suppressed Events: {summary?.commerce_shield.suppressed_events ?? 0}</Text>
              </div>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <PlatformValidationCard model={model} />
          </Layout.Section>

          <Layout.Section>
            <Card>
              <Text as="h3" variant="headingMd">
                Live Payload Viewer
              </Text>
              <div className="spacerTop12">
                <IndexTable
                  resourceName={{ singular: "event", plural: "events" }}
                  itemCount={recent.length}
                  headings={[
                    { title: "#" },
                    { title: "Payload" }
                  ]}
                  selectable={false}
                >
                  {recent.slice(0, 20).map((item, idx) => (
                    <IndexTable.Row id={`${idx}`} key={idx} position={idx}>
                      <IndexTable.Cell>{idx + 1}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <pre className="payloadPre">{JSON.stringify(item, null, 2)}</pre>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
