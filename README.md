# GlyphStorm: WebGPU Adaptive Defense

GlyphStorm is a high-performance, web-based typing defense game that leverages **WebGPU** for rendering and **LiteRT** (formerly TensorFlow Lite) for AI-driven adaptive difficulty.

## 🚀 Features

-   **High-Performance Rendering**: Utilizes WebGPU for hardware-accelerated 2D/3D graphics.
-   **AI Adaptive Difficulty**: Analyze typing patterns (latency, accuracy, speed) to dynamically adjust game difficulty using LiteRT.
-   **AI-Triggered Text-to-Speech**: Words are read aloud when they reach a specific height, which changes based on your performance (AI threshold).
-   **WebGPU Particle System**: Satisfying explosions when destroying enemies, calculated on the GPU.
-   **Dynamic Themes**: Screen colors shift between Flow (Teal), Normal (Gray), and Struggling (Red) based on AI analysis.
-   **Procedural Music & Audio**: Dynamic BPM music and haptic-style typing sounds that react to your game state.
-   **Boss Enemies**: Larger, gold-colored enemies with complex words that appear as you advance.
-   **Smart Word Selection**: The AI learns which letters you struggle with and prioritizes words that challenge your weaknesses.
-   **Procedural Content**: Dynamic word generation and enemy movement.
-   **Modern Tech Stack**: Built with Vite and ES6+ modules.

## 🛠️ Tech Stack

-   **Frontend**: HTML5, Vanilla CSS, JavaScript (ES6+)
-   **Graphics API**: WebGPU
-   **AI Engine**: LiteRT (TensorFlow Lite)
-   **Build Tool**: [Vite](https://vitejs.dev/)

## 🏁 Getting Started

### Prerequisites

-   A browser with **WebGPU** support (e.g., Chrome 113+, Edge 113+).
-   [Node.js](https://nodejs.org/) (v18 or higher recommended).

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/GlyphStorm.git
    cd GlyphStorm
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```

4.  Open the provided URL (usually `http://localhost:5173`) in your browser.

## 📂 Project Structure

-   `index.html`: Main entry point and UI overlay.
-   `src/main.js`: Main game loop and orchestration.
-   `src/webgpu_renderer.js`: WebGPU initialization, shaders, and rendering logic.
-   `src/game_logic.js`: State management, enemy spawning, and input handling.
-   `src/ai_manager.js`: AI analysis and LiteRT integration (currently simulated).

## ⌨️ How to Play

1.  Type the word **"START"** to begin the game.
2.  Enemies will descend from the top of the screen.
3.  Type the characters of an enemy's word to destroy it.
4.  If an enemy reaches the bottom, you lose points.
5.  The AI will monitor your performance and adjust the "Flow State" to keep you challenged.

## 🚧 Future Work

-   Full integration of a trained LiteRT model for behavior classification.
-   Enhanced particle effects and shaders.
-   Online leaderboards.
