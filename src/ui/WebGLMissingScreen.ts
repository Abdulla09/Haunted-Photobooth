/** Blocking message shown when a WebGL2 context cannot be created. Startup stops after this. */
export class WebGLMissingScreen {
  static show(container: HTMLElement): HTMLElement {
    const root = document.createElement('div')
    root.className = 'screen webgl-missing-screen'
    root.setAttribute('role', 'alert')

    const title = document.createElement('h1')
    title.textContent = 'WebGL2 is required'
    const body = document.createElement('p')
    body.textContent =
      'Haunted Photobooth needs WebGL2 to render. Try a current version of Chrome, Edge, Firefox, or Safari, and make sure hardware acceleration is enabled.'

    root.append(title, body)
    container.appendChild(root)
    return root
  }
}
