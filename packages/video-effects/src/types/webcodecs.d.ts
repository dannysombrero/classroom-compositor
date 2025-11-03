export {};

declare global {
  interface MediaStreamTrackProcessorInit {
    track: MediaStreamTrack;
  }

  interface MediaStreamTrackProcessor<T extends VideoFrame = VideoFrame> {
    readonly readable: ReadableStream<T>;
  }

  const MediaStreamTrackProcessor: {
    prototype: MediaStreamTrackProcessor;
    new <T extends VideoFrame = VideoFrame>(init: MediaStreamTrackProcessorInit): MediaStreamTrackProcessor<T>;
  };

  interface MediaStreamTrackGeneratorInit {
    kind: 'audio' | 'video';
  }

  interface MediaStreamTrackGenerator<T extends VideoFrame = VideoFrame> extends MediaStreamTrack {
    readonly writable: WritableStream<T>;
    stop(): void;
  }

  const MediaStreamTrackGenerator: {
    prototype: MediaStreamTrackGenerator;
    new <T extends VideoFrame = VideoFrame>(
      init: MediaStreamTrackGeneratorInit,
    ): MediaStreamTrackGenerator<T>;
  };
}
