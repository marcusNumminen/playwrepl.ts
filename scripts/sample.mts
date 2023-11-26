void await this.page.goto('https://www.saucedemo.com/')
await this.page.locator('[data-test="username"]').fill('standard_user')
await this.page.locator('[data-test="password"]').fill('secret_sauce')
await this.page.locator('[data-test="login-button"]').click();
await this.page.locator('.inventory_item').count()