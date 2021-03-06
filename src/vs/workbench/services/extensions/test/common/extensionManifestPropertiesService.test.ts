/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IExtensionManifest, ExtensionUntrustedWorkpaceSupportType } from 'vs/platform/extensions/common/extensions';
import { ExtensionManifestPropertiesService } from 'vs/workbench/services/extensions/common/extensionManifestPropertiesService';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { TestProductService } from 'vs/workbench/test/common/workbenchTestServices';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IProductService } from 'vs/platform/product/common/productService';
import { isWeb } from 'vs/base/common/platform';
import { TestWorkspaceTrustManagementService } from 'vs/workbench/services/workspaces/test/common/testWorkspaceTrustService';
import { IWorkspaceTrustManagementService } from 'vs/platform/workspace/common/workspaceTrust';
import { NullLogService } from 'vs/platform/log/common/log';

suite('ExtensionManifestPropertiesService - ExtensionKind', () => {

	const testObject = new ExtensionManifestPropertiesService(TestProductService, new TestConfigurationService(), new TestWorkspaceTrustManagementService(), new NullLogService());

	test('declarative with extension dependencies => workspace, web', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ extensionDependencies: ['ext1'] }), ['workspace', 'web']);
	});

	test('declarative extension pack => workspace, web', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ extensionPack: ['ext1', 'ext2'] }), ['workspace', 'web']);
	});

	test('declarative with unknown contribution point => workspace', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ contributes: <any>{ 'unknownPoint': { something: true } } }), ['workspace']);
	});

	test('declarative extension pack with unknown contribution point => workspace', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ extensionPack: ['ext1', 'ext2'], contributes: <any>{ 'unknownPoint': { something: true } } }), ['workspace']);
	});

	test('simple declarative => ui, workspace, web', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{}), ['ui', 'workspace', 'web']);
	});

	test('only browser => web', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ browser: 'main.browser.js' }), ['web']);
	});

	test('only main => workspace', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ main: 'main.js' }), ['workspace']);
	});

	test('main and browser => workspace, web', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ main: 'main.js', browser: 'main.browser.js' }), ['workspace', 'web']);
	});

	test('browser entry point with workspace extensionKind => workspace, web', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ main: 'main.js', browser: 'main.browser.js', extensionKind: ['workspace'] }), ['workspace', 'web']);
	});

	test('simple descriptive with workspace, ui extensionKind => workspace, ui, web', () => {
		assert.deepStrictEqual(testObject.getExtensionKind(<IExtensionManifest>{ extensionKind: ['workspace', 'ui'] }), ['workspace', 'ui', 'web']);
	});
});


// Workspace Trust is disabled in web at the moment
if (!isWeb) {
	suite('ExtensionManifestPropertiesService - ExtensionUntrustedWorkpaceSupportType', () => {
		let testObject: ExtensionManifestPropertiesService;
		let instantiationService: TestInstantiationService;
		let testConfigurationService: TestConfigurationService;

		setup(async () => {
			instantiationService = new TestInstantiationService();

			testConfigurationService = new TestConfigurationService();
			instantiationService.stub(IConfigurationService, testConfigurationService);
			await testConfigurationService.setUserConfiguration('security', { workspace: { trust: { enabled: true } } });
		});

		teardown(() => testObject.dispose());

		function assertUntrustedWorkspaceSupport(extensionMaifest: IExtensionManifest, expected: ExtensionUntrustedWorkpaceSupportType): void {
			testObject = instantiationService.createInstance(ExtensionManifestPropertiesService);
			const untrustedWorkspaceSupport = testObject.getExtensionUntrustedWorkspaceSupportType(extensionMaifest);

			assert.strictEqual(untrustedWorkspaceSupport, expected);
		}

		function getExtensionManifest(properties: any = {}): IExtensionManifest {
			return Object.create({ name: 'a', publisher: 'pub', version: '1.0.0', ...properties }) as IExtensionManifest;
		}

		test('test extension workspace trust request when main entry point is missing', () => {
			instantiationService.stub(IProductService, <Partial<IProductService>>{});
			instantiationService.stub(IWorkspaceTrustManagementService, new TestWorkspaceTrustManagementService());

			const extensionMaifest = getExtensionManifest();
			assertUntrustedWorkspaceSupport(extensionMaifest, true);
		});

		test('test extension workspace trust request when workspace trust is disabled', async () => {
			instantiationService.stub(IProductService, <Partial<IProductService>>{});
			instantiationService.stub(IWorkspaceTrustManagementService, new TestWorkspaceTrustManagementService(false));

			const extensionMaifest = getExtensionManifest({ main: './out/extension.js' });
			assertUntrustedWorkspaceSupport(extensionMaifest, true);
		});

		test('test extension workspace trust request when override exists in settings.json', async () => {
			instantiationService.stub(IProductService, <Partial<IProductService>>{});
			instantiationService.stub(IWorkspaceTrustManagementService, new TestWorkspaceTrustManagementService());

			await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: true } } });
			const extensionMaifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
			assertUntrustedWorkspaceSupport(extensionMaifest, true);
		});

		test('test extension workspace trust request when override for the version exists in settings.json', async () => {
			instantiationService.stub(IProductService, <Partial<IProductService>>{});
			instantiationService.stub(IWorkspaceTrustManagementService, new TestWorkspaceTrustManagementService());

			await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: true, version: '1.0.0' } } });
			const extensionMaifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
			assertUntrustedWorkspaceSupport(extensionMaifest, true);
		});

		test('test extension workspace trust request when override for a different version exists in settings.json', async () => {
			instantiationService.stub(IProductService, <Partial<IProductService>>{});
			instantiationService.stub(IWorkspaceTrustManagementService, new TestWorkspaceTrustManagementService());

			await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: true, version: '2.0.0' } } });
			const extensionMaifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
			assertUntrustedWorkspaceSupport(extensionMaifest, 'limited');
		});

		test('test extension workspace trust request when default exists in product.json', () => {
			instantiationService.stub(IProductService, <Partial<IProductService>>{ extensionUntrustedWorkspaceSupport: { 'pub.a': { default: true } } });
			instantiationService.stub(IWorkspaceTrustManagementService, new TestWorkspaceTrustManagementService());

			const extensionMaifest = getExtensionManifest({ main: './out/extension.js' });
			assertUntrustedWorkspaceSupport(extensionMaifest, true);
		});

		test('test extension workspace trust request when override exists in product.json', () => {
			instantiationService.stub(IProductService, <Partial<IProductService>>{ extensionUntrustedWorkspaceSupport: { 'pub.a': { override: 'limited' } } });
			instantiationService.stub(IWorkspaceTrustManagementService, new TestWorkspaceTrustManagementService());

			const extensionMaifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: true } } });
			assertUntrustedWorkspaceSupport(extensionMaifest, 'limited');
		});

		test('test extension workspace trust request when value exists in package.json', () => {
			instantiationService.stub(IProductService, <Partial<IProductService>>{});
			instantiationService.stub(IWorkspaceTrustManagementService, new TestWorkspaceTrustManagementService());

			const extensionMaifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
			assertUntrustedWorkspaceSupport(extensionMaifest, 'limited');
		});

		test('test extension workspace trust request when no value exists in package.json', () => {
			instantiationService.stub(IProductService, <Partial<IProductService>>{});
			instantiationService.stub(IWorkspaceTrustManagementService, new TestWorkspaceTrustManagementService());

			const extensionMaifest = getExtensionManifest({ main: './out/extension.js' });
			assertUntrustedWorkspaceSupport(extensionMaifest, false);
		});
	});
}
