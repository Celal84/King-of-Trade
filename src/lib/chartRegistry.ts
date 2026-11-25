export interface PaneApi {
  draw: (name: string) => void
  clear: () => void
}

export const paneApis = new Map<number, PaneApi>()
