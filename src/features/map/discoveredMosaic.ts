import type { MapFeature, MapFeatureCollection } from '@/api/types';

type StoredFeature = { feature: MapFeature; quality: number };

// Keep the best geometry seen for each municipality, even after leaving its state.
export class DiscoveredMosaic {
  private states = new Map<string, Map<string, StoredFeature>>();
  private revision = 0;
  private stateRevisions = new Map<string, number>();

  add(parent: string | null, features: MapFeature[] | undefined, quality: number): void {
    if (!parent || !features?.length) return;
    let state = this.states.get(parent);
    if (!state) {
      state = new Map();
      this.states.set(parent, state);
    }
    for (const feature of features) {
      if (feature.properties.level !== 'municipality' || !feature.id.startsWith(parent)) continue;
      const previous = state.get(feature.properties.ibgeCode);
      if (!previous || quality > previous.quality || (quality === previous.quality && feature.geometry !== previous.feature.geometry)) {
        state.set(feature.properties.ibgeCode, { feature, quality });
        this.revision += 1;
        this.stateRevisions.set(parent, this.revision);
      }
    }
  }

  addCollection(collection: MapFeatureCollection | undefined, parent: string | null): void {
    if (collection?.scope.level !== 'municipality' || collection.scope.parent !== parent) return;
    this.add(parent, collection.features, collection.scope.lod === 'detail' ? 3 : 1);
  }

  forState(parent: string | null): MapFeature[] {
    return parent ? [...(this.states.get(parent)?.values() ?? [])].map((item) => item.feature) : [];
  }

  all(): MapFeature[] {
    return [...this.states.values()].flatMap((state) =>
      [...state.values()].map((item) => item.feature),
    );
  }

  get version(): number {
    return this.revision;
  }

  versions(): Map<string, number> {
    return new Map(this.stateRevisions);
  }
}
