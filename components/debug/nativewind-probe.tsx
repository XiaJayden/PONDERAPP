import React, { useEffect } from "react";
import { Text, View } from "react-native";

type Props = {
  label?: string;
  className?: string;
  style?: any;
};

export function NativeWindProbe(props: Props) {
  useEffect(() => {
    // Intentionally empty: this component is only for visual verification during debugging.
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


