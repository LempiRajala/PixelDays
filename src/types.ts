import type { CSSProperties } from "react";

export type Vec2<T> = [T, T]
export type Vec3<T> = [T, T, T]
export type Vec4<T> = [T, T, T, T]

export interface PropsWithStyle {
  style?: CSSProperties;
}