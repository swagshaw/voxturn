# voxturn — demo site

Interactive demo of **voxturn**, an open audio turn-taking model for voice agents: it answers several turn-taking
questions (has the user finished? will they go on? backchannel or interruption? is the sound speech at all?) in one
forward pass, in about 8 ms on one GPU.

- Model, code and Pipecat / LiveKit plugins: https://huggingface.co/AustinXiao/voxturn-v1
- This site is static (GitHub Pages). Every example was computed offline: real eot-bench user turns replayed through
  Pipecat's Silero VAD with Pipecat's default turn model (Smart Turn v3) and with voxturn.

Licences: voxturn weights and code, CC BY-NC 4.0. Demo audio, word timings and pause labels from
[LiveKit eot-bench](https://huggingface.co/datasets/livekit/eot-bench-data), CC BY 4.0. Baseline numbers are the
official eot-bench results.
