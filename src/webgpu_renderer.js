export class WebGPURenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.adapter = null;
        this.device = null;
        this.context = null;
        this.format = navigator.gpu.getPreferredCanvasFormat();
    }

    async init() {
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported on this browser.");
        }

        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) {
            throw new Error("No appropriate GPUAdapter found.");
        }

        this.device = await this.adapter.requestDevice();
        this.context = this.canvas.getContext("webgpu");

        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: "premultiplied",
        });

        await this.initPipeline();
        console.log("WebGPU Initialized");
    }

    async initPipeline() {
        const shaderModule = this.device.createShaderModule({
            label: 'Enemy Shader',
            code: `
                struct Uniforms {
                    screenSize: vec2f,
                }
                @group(0) @binding(0) var<uniform> uniforms: Uniforms;

                struct VertexOutput {
                    @builtin(position) position: vec4f,
                    @location(0) color: vec4f,
                }

                struct InstanceInput {
                    @location(0) pos: vec2f,
                    @location(1) size: vec2f,
                    @location(2) color: vec3f,
                }

                @vertex
                fn vs(
                    @builtin(vertex_index) vertexIndex: u32,
                    instance: InstanceInput
                ) -> VertexOutput {
                    var pos = array<vec2f, 6>(
                        vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
                        vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
                    );
                    
                    let vertexPos = pos[vertexIndex];
                    // Map 0..1 to -1..1 clip space, adjusting for instance pos and size
                    // Instance pos is 0..1 (top-left origin for game logic, but clip space is center origin)
                    // Let's assume game logic sends 0..1 coordinates where (0,0) is top-left.
                    
                    let pixelPos = (instance.pos + vertexPos * instance.size) * uniforms.screenSize;
                    let clipPos = (pixelPos / uniforms.screenSize) * 2.0 - 1.0;
                    
                    // Flip Y because WebGPU clip space Y is up, but screen Y is usually down
                    var output: VertexOutput;
                    output.position = vec4f(clipPos.x, -clipPos.y, 0.0, 1.0);
                    output.color = vec4f(instance.color, 1.0);
                    return output;
                }

                @fragment
                fn fs(input: VertexOutput) -> @location(0) vec4f {
                    return input.color;
                }
            `
        });

        this.pipeline = this.device.createRenderPipeline({
            label: 'Enemy Pipeline',
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs',
                buffers: [{
                    arrayStride: 7 * 4, // 2+2+3 floats * 4 bytes
                    stepMode: 'instance',
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x2' }, // pos
                        { shaderLocation: 1, offset: 8, format: 'float32x2' }, // size
                        { shaderLocation: 2, offset: 16, format: 'float32x3' }, // color
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs',
                targets: [{ format: this.format }]
            }
        });

        this.uniformBuffer = this.device.createBuffer({
            size: 8, // vec2f
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });

        // Initial instance buffer capacity
        this.instanceBufferCapacity = 100;
        this.instanceBuffer = this.device.createBuffer({
            size: this.instanceBufferCapacity * 7 * 4,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }

    render(gameState) {
        if (!this.device || !this.pipeline) return;

        // Update Uniforms
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([canvasWidth, canvasHeight]));

        // Prepare Instance Data
        const enemies = gameState.enemies || [];
        const instanceCount = enemies.length;

        if (instanceCount > 0) {
            // Resize buffer if needed
            if (instanceCount > this.instanceBufferCapacity) {
                this.instanceBufferCapacity = instanceCount * 2;
                this.instanceBuffer.destroy();
                this.instanceBuffer = this.device.createBuffer({
                    size: this.instanceBufferCapacity * 7 * 4,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                });
            }

            const instanceData = new Float32Array(instanceCount * 7);
            for (let i = 0; i < instanceCount; i++) {
                const e = enemies[i];
                const offset = i * 7;
                instanceData[offset + 0] = e.x; // x
                instanceData[offset + 1] = e.y; // y
                instanceData[offset + 2] = 0.1; // width (relative to screen 0-1)
                instanceData[offset + 3] = 0.05; // height
                instanceData[offset + 4] = 1.0; // r
                instanceData[offset + 5] = 0.0; // g
                instanceData[offset + 6] = 0.0; // b
            }
            this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
        }

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        if (instanceCount > 0) {
            passEncoder.setVertexBuffer(0, this.instanceBuffer);
            passEncoder.draw(6, instanceCount);
        }
        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }
}
