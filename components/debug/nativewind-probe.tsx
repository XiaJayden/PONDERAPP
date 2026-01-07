import React, { useEffect } from "react";
import { Text, View } from "react-native";

type Props = {
  label?: string;
  className?: string;
  style?: any;
};

export function NativeWindProbe(props: Props) {
  useEffect(() => {
    // #region agent log (hypothesisId:H1)
    fetch("http://127.0.0.1:7243/ingest/aff388a3-96fd-4fa2-9425-e1475bf41c13", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "components/debug/nativewind-probe.tsx:15",
        message: "NativeWindProbe mounted (props snapshot)",
        data: {
          label: props.label ?? null,
          propKeys: Object.keys(props ?? {}),
          classNameType: typeof (props as any)?.className,
          classNameValue: (props as any)?.className ?? null,
          styleType: typeof (props as any)?.style,
          styleIsArray: Array.isArray((props as any)?.style),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, []);

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ fontSize: 11, opacity: 0.6 }}>
        {props.label ?? "NativeWindProbe"} (if you see this, probe rendered)
      </Text>
      <View
        // If NativeWind transform is active, we expect this to be converted to a style prop.
        className="mt-2 h-6 w-24 rounded bg-primary"
        style={{}}
      />
    </View>
  );
}


